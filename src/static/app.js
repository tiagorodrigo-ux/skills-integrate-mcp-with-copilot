document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginForm = document.getElementById("login-form");
  const userSession = document.getElementById("user-session");
  const sessionText = document.getElementById("session-text");
  const logoutBtn = document.getElementById("logout-btn");
  const accessNote = document.getElementById("access-note");
  const emailInput = document.getElementById("email");

  let authToken = localStorage.getItem("authToken") || "";
  let currentUser = null;

  function setMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function isStaff() {
    return (
      currentUser &&
      ["staff", "teacher", "admin"].includes(currentUser.role)
    );
  }

  function authHeaders() {
    if (!authToken) {
      return {};
    }

    return {
      Authorization: `Bearer ${authToken}`,
    };
  }

  function updateAuthUI() {
    if (currentUser) {
      loginForm.classList.add("hidden");
      userSession.classList.remove("hidden");
      sessionText.textContent = `Signed in as ${currentUser.username} (${currentUser.role})`;

      signupForm.classList.remove("hidden");
      accessNote.textContent = isStaff()
        ? "Staff can register or unregister any student."
        : "Students can only manage their own registration.";

      if (isStaff()) {
        emailInput.readOnly = false;
        emailInput.value = "";
        emailInput.placeholder = "student-email@mergington.edu";
      } else {
        emailInput.readOnly = true;
        emailInput.value = currentUser.email;
      }
    } else {
      loginForm.classList.remove("hidden");
      userSession.classList.add("hidden");
      signupForm.classList.add("hidden");
      accessNote.textContent =
        "Sign in to register. Students can only manage their own registration.";
      emailInput.readOnly = false;
      emailInput.value = "";
      emailInput.placeholder = "your-email@mergington.edu";
    }
  }

  async function restoreSession() {
    if (!authToken) {
      currentUser = null;
      updateAuthUI();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: authHeaders(),
      });

      if (!response.ok) {
        throw new Error("Session not valid");
      }

      currentUser = await response.json();
    } catch (error) {
      authToken = "";
      currentUser = null;
      localStorage.removeItem("authToken");
    }

    updateAuthUI();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML = details.participants.length
          ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li>
                        <span class="participant-email">${email}</span>
                        ${
                          isStaff()
                            ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                            : ""
                        }
                      </li>`
                  )
                  .join("")}
              </ul>
            </div>`
          : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      if (isStaff()) {
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!currentUser) {
      setMessage("Please log in first.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.detail || "Login failed", "error");
        return;
      }

      authToken = result.token;
      currentUser = result.user;
      localStorage.setItem("authToken", authToken);

      loginForm.reset();
      updateAuthUI();
      fetchActivities();
      setMessage("Login successful", "success");
    } catch (error) {
      setMessage("Could not log in. Please try again.", "error");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    if (!authToken) {
      return;
    }

    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: authHeaders(),
      });
    } catch (error) {
      console.error("Logout request failed", error);
    }

    authToken = "";
    currentUser = null;
    localStorage.removeItem("authToken");
    updateAuthUI();
    fetchActivities();
    setMessage("Logged out", "success");
  });

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      setMessage("Please log in first.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    if (!activity) {
      setMessage("Please select an activity.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");

        if (isStaff()) {
          signupForm.reset();
        }

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  restoreSession().then(fetchActivities);
});
