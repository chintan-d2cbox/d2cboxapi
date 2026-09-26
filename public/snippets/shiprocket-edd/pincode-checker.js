(() => {
  const ENDPOINT = '__API_ORIGIN__/api/shiprocket/edd';

  const formatDate = (value) => {
    // Parse YYYY-MM-DD manually to avoid timezone shifts; fall back to native parsing
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    const date = m ? new Date(m[1], m[2] - 1, m[3]) : new Date(value);
    if (isNaN(date)) return value;

    const part = (opts) => date.toLocaleDateString('en-GB', opts);
    return `${date.getDate()} ${part({ month: 'long' })} ${date.getFullYear()}`;
  };

  const check = async (checker) => {
    const input = checker.querySelector('#pincode-input');
    const button = checker.querySelector('.pincode-checker__submit');
    const result = checker.querySelector('.pincode-checker__result');
    const pincode = input.value.trim();

    if (pincode.length !== 6 || button.disabled) return;

    const show = (type, message) => {
      result.classList.remove('error', 'success');
      result.classList.add(type);
      result.innerHTML = message;
    };

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    result.classList.remove('error', 'success');
    result.innerHTML = '';

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pincode })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || data.error);

      if (data.serviceable) {
        show('success', `Estimated delivery by <strong>${formatDate(data.etd)}</strong>`);
      } else {
        show('error', `Delivery not available for this pincode ${pincode}`);
      }
    } catch (err) {
      console.log(err);
      show('error', 'Unable to check right now. Please try again.');
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  };

  // Digits only, enable button at 6 digits
  document.addEventListener('input', (e) => {
    if (!e.target.matches('.pincode-checker #pincode-input')) return;

    const input = e.target;
    input.value = input.value.replace(/\D/g, '').slice(0, 6);
    input.closest('.pincode-checker').querySelector('.pincode-checker__submit').disabled = input.value.length !== 6;
  });

  // Button click
  document.addEventListener('click', (e) => {
    const button = e.target.closest('.pincode-checker__submit');
    if (button) check(button.closest('.pincode-checker'));
  });

  // Enter key (stops form from reloading the page)
  document.addEventListener('submit', (e) => {
    if (!e.target.matches('.pincode-checker__row')) return;
    e.preventDefault();
    check(e.target.closest('.pincode-checker'));
  });
})();
