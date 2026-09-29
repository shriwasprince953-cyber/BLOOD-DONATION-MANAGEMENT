"""Headless UI regressions with synthetic auth and API responses only.

Run the dev server on 127.0.0.1:5179 with VITE_SUPABASE_URL set to
https://test-project.supabase.co and VITE_SUPABASE_ANON_KEY=test-public-key.
Requires Selenium and Chrome. No requests reach real auth/API services.
"""
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

MOCKS = r"""
(() => {
  const uid = '78a61630-25d7-4b1a-a579-3c8772109a12';
  const rid = 'd8a61630-25d7-4b1a-a579-3c8772109a12';
  const originalFetch = window.fetch.bind(window);
  window.__calls = [];
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const scenario = localStorage.getItem('__scenario') || 'login';
    const method = options.method || 'GET';
    const reply = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
    if (url.hostname.endsWith('supabase.co')) {
      window.__calls.push(method + ' ' + url.pathname);
      if (url.pathname.endsWith('/token')) {
        if (scenario === 'invalid-login') return reply({ error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + btoa(JSON.stringify({ sub: uid, exp, aud: 'authenticated' })) + '.test';
        return reply({ access_token: token, refresh_token: 'test-refresh-token', expires_in: 3600, expires_at: exp, token_type: 'bearer', user: { id: uid, email: 'donor@example.com', aud: 'authenticated', role: 'authenticated', user_metadata: { full_name: 'Test Donor' } } });
      }
      if (url.pathname.endsWith('/logout') || url.pathname.endsWith('/recover')) return reply({});
      if (url.pathname.endsWith('/signup')) return reply({ id: uid, email: 'donor@example.com', identities: [] });
      return reply({ id: uid, email: 'donor@example.com' });
    }
    if (url.port === '8000') {
      window.__calls.push(method + ' ' + url.pathname);
      const isAdmin = scenario.startsWith('admin');
      const donor = { blood_group: 'O+', city: 'Test City', is_available: true, last_donation_date: null };
      const profile = { id: uid, full_name: 'Test Donor', email: 'donor@example.com', role: isAdmin ? 'ADMIN' : 'DONOR', donor: scenario === 'missing-profile' ? null : donor };
      if (url.pathname.endsWith('/auth/me')) {
        if (scenario === 'server-error') return reply({ detail: 'Authentication service is temporarily unavailable.' }, 503);
        if (scenario === 'missing-profile' && !localStorage.getItem('__registered')) return reply({ detail: 'Complete profile setup first.' }, 403);
        if (method === 'PATCH' && scenario === 'profile-save-error') return reply({ detail: 'Profile save failed' }, 500);
        return reply(profile);
      }
      if (url.pathname.endsWith('/auth/register')) {
        localStorage.setItem('__registered', 'yes');
        return reply(profile, 201);
      }
      if (url.pathname.endsWith('/admin/stats')) return reply({ totalRequests: 1, activeRequests: 1, totalDonors: 2 });
      const request = { id: rid, patient_name: 'Test Patient', blood_group: 'O+', hospital_name: 'Test Hospital', location: 'Test City', units_required: 2, urgency_level: 'CRITICAL', status: 'OPEN', created_at: '2026-09-29T12:00:00Z' };
      if (url.pathname.endsWith('/notify')) return reply({ detail: 'Notification queue unavailable' }, 503);
      if (url.pathname.endsWith('/donors')) return reply([]);
      if (url.pathname.endsWith('/requirements/' + rid)) return reply(request);
      if (url.pathname.endsWith('/responses/me')) return reply({ items: [], total: 0 });
      if (url.pathname.endsWith('/responses')) return reply({ detail: 'Donation response could not be saved' }, 500);
      if (url.pathname.endsWith('/donors/me/requirements')) {
        if (scenario === 'missing-profile') return reply({ detail: 'Donor profile is not registered.' }, 403);
        return reply([]);
      }
      if (url.pathname.endsWith('/requirements')) {
        if (method === 'POST') return reply({ detail: 'Request creation failed' }, 500);
        return reply({ items: isAdmin ? [request] : [], total: isAdmin ? 1 : 0 });
      }
      return reply({});
    }
    if (url.origin !== window.location.origin) throw new Error('External request blocked by test');
    return originalFetch(input, options);
  };
})();
"""

options = webdriver.ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--window-size=1440,1000')
options.add_argument('--disable-background-networking')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 15)
driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {'source': MOCKS})
base = 'http://127.0.0.1:5179'

def body_contains(text):
    wait.until(lambda d: text in d.find_element(By.TAG_NAME, 'body').text)

def scenario(name, route='/login'):
    driver.get(base + '/login')
    driver.execute_script('localStorage.clear(); localStorage.setItem("__scenario", arguments[0]);', name)
    driver.get(base + route)

def fill(element_id, value):
    element = wait.until(EC.visibility_of_element_located((By.ID, element_id)))
    element.clear()
    element.send_keys(value)

def login(name, admin=False):
    scenario(name, '/admin/login' if admin else '/login')
    fill('email', 'donor@example.com')
    fill('password', 'test-password')
    driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]').click()

try:
    login('invalid-login')
    body_contains('Invalid login credentials')
    assert driver.current_url.endswith('/login')
    print('PASS invalid login displays auth error')

    login('login')
    body_contains('Welcome back,')
    body_contains('No matching requests')
    assert 'City Care Hospital' not in driver.page_source
    print('PASS donor login and empty dashboard without mock records')

    login('missing-profile')
    body_contains('Complete your donor profile')
    assert driver.execute_script('return localStorage.getItem("__registered")') == 'yes'
    print('PASS confirmed signup provisions profile and opens dashboard')

    login('server-error')
    body_contains('Authentication service is temporarily unavailable.')
    assert not any('/logout' in call for call in driver.execute_script('return window.__calls'))
    driver.get(base + '/dashboard')
    body_contains('Unable to verify account access')
    driver.execute_script('localStorage.setItem("__scenario", "login")')
    driver.find_element(By.CSS_SELECTOR, 'button').click()
    body_contains('Welcome back,')
    print('PASS server failure preserves session and route retry recovers')

    login('profile-save-error')
    body_contains('Welcome back,')
    driver.get(base + '/profile')
    fill('fullName', 'Updated Donor')
    assert not driver.find_element(By.ID, 'bloodGroup').is_enabled()
    driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]').click()
    body_contains('Profile save failed')
    assert 'Profile updated successfully' not in driver.find_element(By.TAG_NAME, 'body').text
    print('PASS failed profile save is an error and blood group is locked')

    driver.get(base + '/requirements/d8a61630-25d7-4b1a-a579-3c8772109a12')
    body_contains('Test Patient')
    donate = wait.until(lambda d: next((b for b in d.find_elements(By.TAG_NAME, 'button') if 'I Can Donate' in b.text), False))
    donate.click()
    body_contains('Donation response could not be saved')
    print('PASS failed donation does not report success')

    login('admin-login', admin=True)
    body_contains('Post Emergency Blood Request')
    assert driver.current_url.endswith('/admin')
    driver.get(base + '/profile')
    body_contains('My Profile')
    wait.until(EC.visibility_of_element_located((By.ID, 'fullName')))
    assert driver.current_url.endswith('/profile')
    print('PASS admin login and admin profile access')

    scenario('reset', '/forgot-password')
    fill('recovery-email', 'donor@example.com')
    driver.find_element(By.CSS_SELECTOR, 'form button').click()
    body_contains('If an account exists')
    scenario('reset', '/reset-password')
    fill('new-password', 'new-password')
    fill('confirm-password', 'different-password')
    driver.find_element(By.CSS_SELECTOR, 'form button').click()
    body_contains('Passwords do not match')
    fill('confirm-password', 'new-password')
    driver.find_element(By.CSS_SELECTOR, 'form button').click()
    body_contains('invalid or expired')
    print('PASS password recovery and invalid reset link handling')

    errors = [entry['message'] for entry in driver.get_log('browser') if entry['level'] == 'SEVERE' and ('Uncaught' in entry['message'] or 'TypeError' in entry['message'])]
    assert not errors, errors
    print('PASS no uncaught browser errors')
finally:
    driver.quit()
