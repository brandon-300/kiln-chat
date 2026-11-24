(function () {
  if (!window.KilnNative || typeof window.KilnNative.request !== "function") return;
  var jobs = {};
  function b64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToB64(bytes) {
    var bin = "";
    var size = 0x1000;
    for (var i = 0; i < bytes.length; i += size) {
      var slice = bytes.subarray(i, i + size);
      var part = "";
      for (var j = 0; j < slice.length; j++) part += String.fromCharCode(slice[j]);
      bin += part;
    }
    return btoa(bin);
  }
  window.__kilnHead = function (id, status, headersB64) {
    var job = jobs[id];
    if (!job) return;
    var headers = {};
    try {
      headers = JSON.parse(atob(headersB64));
    } catch (e) {}
    var stream = new ReadableStream({
      start: function (controller) {
        job.controller = controller;
        var queued = job.queue;
        job.queue = [];
        for (var i = 0; i < queued.length; i++) controller.enqueue(queued[i]);
        if (job.ended) {
          if (job.endError) controller.error(new Error(job.endError));
          else controller.close();
        }
      },
      cancel: function () {
        try {
          window.KilnNative.cancel(id);
        } catch (e) {}
      },
    });
    job.settled = true;
    job.resolve(new Response(stream, { status: status, headers: headers }));
  };
  window.__kilnChunk = function (id, b64) {
    var job = jobs[id];
    if (!job || job.ended) return;
    var bytes = b64ToBytes(b64);
    if (job.controller) job.controller.enqueue(bytes);
    else job.queue.push(bytes);
  };
  window.__kilnEnd = function (id, errB64) {
    var job = jobs[id];
    if (!job) return;
    var err = "";
    if (errB64) {
      try {
        err = atob(errB64);
      } catch (e) {
        err = "The network request failed.";
      }
    }
    job.ended = true;
    job.endError = err;
    if (!job.settled) {
      job.reject(new Error(err || "The network request failed."));
      delete jobs[id];
      return;
    }
    if (job.controller) {
      if (err) job.controller.error(new Error(err));
      else job.controller.close();
    }
    delete jobs[id];
  };
  var orig = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : input && input.url;
    var abs;
    try {
      abs = new URL(url, location.href).href;
    } catch (e) {
      return orig(input, init);
    }
    if (abs.indexOf("https://") !== 0 || abs.indexOf(location.origin) === 0) return orig(input, init);
    return kilnNativeFetch(abs, init || {});
  };
  function kilnNativeFetch(url, init) {
    return new Promise(function (resolve, reject) {
      var id = Math.random().toString(36).slice(2, 12);
      var headers = {};
      var method = (init.method || "GET").toUpperCase();
      try {
        new Headers(init.headers || {}).forEach(function (value, key) {
          headers[key] = value;
        });
      } catch (e) {}
      function send(bodyBytes) {
        if (bodyBytes && bodyBytes.byteLength > 8000000) {
          reject(new Error("That upload is too large for this phone."));
          return;
        }
        jobs[id] = { resolve: resolve, reject: reject, queue: [], settled: false, ended: false, controller: null, endError: "" };
        if (init.signal) {
          if (init.signal.aborted) {
            delete jobs[id];
            reject(new DOMException("Aborted", "AbortError"));
            return;
          }
          init.signal.addEventListener("abort", function () {
            try {
              window.KilnNative.cancel(id);
            } catch (e) {}
          });
        }
        var bodyB64 = bodyBytes && bodyBytes.byteLength ? bytesToB64(bodyBytes) : "";
        window.KilnNative.request(id, method, url, JSON.stringify(headers), bodyB64);
      }
      var body = init.body;
      if (!body) {
        send(null);
        return;
      }
      if (typeof body === "string") {
        send(new TextEncoder().encode(body));
        return;
      }
      if (body instanceof Uint8Array) {
        send(body);
        return;
      }
      if (body instanceof ArrayBuffer) {
        send(new Uint8Array(body));
        return;
      }
      var req = new Request(url, { method: method, headers: init.headers, body: body });
      var ct = req.headers.get("content-type");
      if (ct) headers["content-type"] = ct;
      req.arrayBuffer().then(function (buf) {
        send(new Uint8Array(buf));
      }).catch(reject);
    });
  }
})();
