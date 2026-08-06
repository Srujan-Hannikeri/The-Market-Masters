// Temporary runtime fix for broken Authorization header in api.getHeaders
// This overrides api.getHeaders to ensure it returns a valid "Bearer <token>" header.
(function(){
  function safeGetHeaders() {
    try {
      // If api exists and has getHeaders, call it to reuse any existing logic
      if (typeof api !== 'undefined' && typeof api.getHeaders === 'function') {
        const hdrs = api.getHeaders();
        // Ensure Authorization is correctly formatted
        const token = api.getToken ? api.getToken() : (localStorage.getItem ? localStorage.getItem('token') : null);
        if (token) {
          hdrs['Authorization'] = `Bearer ${token}`;
        } else {
          delete hdrs['Authorization'];
        }
        return hdrs;
      }
    } catch (e) {
      // Fall through to default header if original fails
      console.error('fix-api: original api.getHeaders failed', e);
    }

    const headers = { 'Content-Type': 'application/json' };
    const token = (localStorage && localStorage.getItem) ? localStorage.getItem('token') : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  // Override or set api.getHeaders after api is loaded
  if (typeof api !== 'undefined') {
    api.getHeaders = safeGetHeaders;
  } else {
    // If api isn't defined yet, attach to window to be called by other modules
    window.__fixApi_getHeaders = safeGetHeaders;
    // Poll until api exists then patch it
    const intv = setInterval(() => {
      if (typeof api !== 'undefined') {
        api.getHeaders = safeGetHeaders;
        if (window.__fixApi_getHeaders) delete window.__fixApi_getHeaders;
        clearInterval(intv);
      }
    }, 50);
  }
})();
