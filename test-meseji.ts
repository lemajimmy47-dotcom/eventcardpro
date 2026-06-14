const apiKey = "zs_15d4cb14d3f3d0cc6f38b682f938c62be138f5e00b6644ea";
fetch("https://meseji.co.tz/api/v1/sms/balance", {
  method: "GET",
  headers: {
    "x-api-key": apiKey,
    "Accept": "application/json"
  }
}).then(res => res.text()).then(text => console.log("RAW MESEJI RESPONSE:", text));
