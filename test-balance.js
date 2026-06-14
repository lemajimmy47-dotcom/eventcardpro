async function check() {
  const url1 = "https://meseji.co.tz/api/v1/sms/balance";
  const url2 = "https://meseji.co.tz/api/v1/balance";

  try {
    const res1 = await fetch(url1, { method: 'GET'});
    console.log("url1:", res1.status, await res1.text().catch(()=>""));
  } catch(e) { console.log("err1", e) }

  try {
    const res2 = await fetch(url2, { method: 'GET'});
    console.log("url2:", res2.status, await res2.text().catch(()=>""));
  } catch(e) { console.log("err2", e) }
}
check();
