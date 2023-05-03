onmessage = function(e) {
  if (e.data === "ERROR")
    throw new Error("worker received ERROR");

  postMessage(e.data.toUpperCase());
}

