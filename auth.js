/* =========================================================
   auth.js — Authentication Integration Layer
   =========================================================
   Currently using LocalStorage to simulate a backend so the
   app is fully functional for testing.
========================================================= */

const Auth = {
  currentUser: null,

  init: function(onStateChange) {
    const session = localStorage.getItem("quizspace_session");
    if (session) {
      this.currentUser = JSON.parse(session);
    }
    onStateChange(this.currentUser);
  },

  login: async function(email, password) {
    console.log(`AUTH: Attempting login for ${email}`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const users = JSON.parse(localStorage.getItem("quizspace_users")) || [];
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      throw new Error("Invalid email or password.");
    }

    this.currentUser = { id: user.id, email: user.email, name: user.name, username: user.username };
    localStorage.setItem("quizspace_session", JSON.stringify(this.currentUser));
    
    // Trigger global login success (without re-binding event listeners)
    onLoginSuccess(this.currentUser);
  },

  signup: async function(email, password, username, fullName) {
    console.log(`AUTH: Attempting signup for ${email}`);
    
    await new Promise(resolve => setTimeout(resolve, 800));

    const users = JSON.parse(localStorage.getItem("quizspace_users")) || [];
    
    if (users.find(u => u.email === email)) {
      throw new Error("An account with this email already exists.");
    }

    const newUser = {
      id: 'usr_' + Date.now(),
      email: email,
      password: password, // In a real app, NEVER store plain text passwords
      username: username,
      name: fullName
    };

    users.push(newUser);
    localStorage.setItem("quizspace_users", JSON.stringify(users));
    
    // Automatically log them in after signup
    this.currentUser = { id: newUser.id, email: newUser.email, name: newUser.name, username: newUser.username };
    localStorage.setItem("quizspace_session", JSON.stringify(this.currentUser));
    
    // Trigger global login success (without re-binding event listeners)
    onLoginSuccess(this.currentUser);
  },

  logout: async function() {
    console.log("AUTH: Logging out");
    this.currentUser = null;
    localStorage.removeItem("quizspace_session");
  },

  resetPassword: async function(email) {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const users = JSON.parse(localStorage.getItem("quizspace_users")) || [];
    if (!users.find(u => u.email === email)) {
      throw new Error("No account found with that email address.");
    }
    
    return "A password reset link has been sent to your email (simulated).";
  }
};
