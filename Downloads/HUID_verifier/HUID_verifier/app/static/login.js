document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Get form elements
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.querySelector('#loginForm button[type="submit"]');
  const msgDiv = document.getElementById('loginMessage');
  
  // Get and trim values
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  
  // Clear previous messages
  msgDiv.innerHTML = '';
  msgDiv.className = '';
  
  // Validate inputs
  if (!email || !password) {
    showError(msgDiv, 'Please enter both email and password');
    return;
  }

  // Email format validation
  if (!validateEmail(email)) {
    showError(msgDiv, 'Please enter a valid email address');
    return;
  }

  try {
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...';
    
    const response = await fetch('/login', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRFToken': getCSRFToken() // Add if using CSRF protection
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    if (data.success) {
      showSuccess(msgDiv, 'Login successful! Redirecting...');
      
      // Redirect to either the provided URL or home page
      setTimeout(() => {
        window.location.href = data.redirect || '/';
      }, 1500);
    } else {
      showError(msgDiv, data.error || 'Invalid credentials');
    }
  } catch (error) {
    console.error('Login error:', error);
    
    // Handle different error types
    if (error.message.includes('NetworkError')) {
      showError(msgDiv, 'Network error. Please check your connection.');
    } else {
      showError(msgDiv, error.message || 'An error occurred during login');
    }
    
    // Clear password field for security
    passwordInput.value = '';
  } finally {
    // Restore button state
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i> Login';
  }
});

// Helper functions
function showError(element, message) {
  element.innerHTML = `<div class="alert alert-danger">${message}</div>`;
  element.classList.add('shake-animation');
  setTimeout(() => element.classList.remove('shake-animation'), 500);
}

function showSuccess(element, message) {
  element.innerHTML = `<div class="alert alert-success">${message}</div>`;
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function getCSRFToken() {
  // Get CSRF token from meta tag if using Flask-WTF
  return document.querySelector('meta[name="csrf-token"]')?.content || '';
}

// Add this to your CSS
const style = document.createElement('style');
style.textContent = `
  .shake-animation {
    animation: shake 0.5s;
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-5px); }
    40%, 80% { transform: translateX(5px); }
  }
`;
document.head.appendChild(style);