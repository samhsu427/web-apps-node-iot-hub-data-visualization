/* eslint-disable max-classes-per-file */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
$(document).ready(() => {
  // if deployed to a site supporting SSL, use wss://
  const protocol = document.location.protocol.startsWith('https') ? 'wss://' : 'ws://';
  const webSocket = new WebSocket(protocol + location.host);

  // A class for holding the last N points of telemetry for a device
  class DeviceData {
    constructor(deviceId) {
      this.deviceId = deviceId;
      this.maxLen = 50;
      this.timeData = new Array(this.maxLen);
      this.edgexData = new Array(this.maxLen);
    }

    addData(time, edgexData) {
      this.timeData.push(time);
      this.edgexData.push(edgexData);

      if (this.timeData.length > this.maxLen) {
        this.timeData.shift();
        this.edgexData.shift();
      }
    }
  }

  // All the devices in the list (those that have been sending telemetry)
  class TrackedDevices {
    constructor() {
      this.devices = [];
    }

    // Find a device based on its Id
    findDevice(deviceId) {
      for (let i = 0; i < this.devices.length; ++i) {
        if (this.devices[i].deviceId === deviceId) {
          return this.devices[i];
        }
      }

      return undefined;
    }

    getDevicesCount() {
      return this.devices.length;
    }
  }

  const trackedDevices = new TrackedDevices();

  // Define the chart axes
  const chartData = {
    datasets: [
      {
        fill: false,
        label: '',
        yAxisID: '',
        borderColor: 'rgba(51, 187, 255, 1)',
        pointBoarderColor: 'rgba(51, 187, 255, 1)',
        backgroundColor: 'rgba(51, 187, 255, 1)',
        pointHoverBackgroundColor: 'rgba(51, 187, 255, 1)',
        pointHoverBorderColor: 'rgba(51, 187, 255, 1)',
        spanGaps: true,
      }
    ]
  };

  const chartOptions = {
    scales: {
      yAxes: [{
        id: '',
        type: 'linear',
        scaleLabel: {
          labelString: 'Value',
          display: true,
        },
        position: 'left',
      }]
    }
  };

  // Get the context of the canvas element we want to select
  const ctx = document.getElementById('iotChart').getContext('2d');
  const myLineChart = new Chart(
    ctx,
    {
      type: 'line',
      data: chartData,
      options: chartOptions,
    });

  // Manage a list of devices in the UI, and update which device data the chart is showing
  // based on selection
  let needsAutoSelect = true;
  const deviceCount = document.getElementById('deviceCount');
  const listOfDevices = document.getElementById('listOfDevices');
  function OnSelectionChange() {
    const device = trackedDevices.findDevice(listOfDevices[listOfDevices.selectedIndex].text);
    chartData.labels = device.timeData;
    chartData.datasets[0].label = device.deviceId;
    chartData.datasets[0].data = device.edgexData;
    myLineChart.update();
  }
  listOfDevices.addEventListener('change', OnSelectionChange, false);

  // When a web socket message arrives:
  // 1. Unpack it
  // 2. Validate it has date/time and temperature
  // 3. Find or create a cached device to hold the telemetry data
  // 4. Append the telemetry data
  // 5. Update the chart UI
  webSocket.onmessage = function onMessage(message) {
    try {
      const messageData = JSON.parse(message.data);
      console.log(messageData.MessageDate, messageData.ServiceId, messageData.DeviceId, messageData.Value);

      // time, service, device and value are required
      if (!messageData.MessageDate || !messageData.ServiceId || !messageData.DeviceId || !messageData.Value) {
        return;
      }

      // find or add device to list of tracked devices
      const edgexDeviceName = messageData.ServiceId + "\\" + messageData.DeviceId;
      const existingDeviceData = trackedDevices.findDevice(edgexDeviceName);

      if (existingDeviceData) {
        existingDeviceData.addData(messageData.MessageDate, messageData.Value);
      } else {
        const newDeviceData = new DeviceData(edgexDeviceName);
        trackedDevices.devices.push(newDeviceData);
        const numDevices = trackedDevices.getDevicesCount();
        deviceCount.innerText = numDevices === 1 ? `${numDevices} device` : `${numDevices} devices`;
        newDeviceData.addData(messageData.MessageDate, messageData.Value);

        const node = document.createElement('option');
        const nodeText = document.createTextNode(edgexDeviceName);
        node.appendChild(nodeText);
        listOfDevices.appendChild(node);

        // if this is the first device being discovered, auto-select it
        if (needsAutoSelect) {
          needsAutoSelect = false;
          listOfDevices.selectedIndex = 0;
          OnSelectionChange();
        }
      }

      myLineChart.update();
    } catch (err) {
      console.error(err);
    }
  };
});
