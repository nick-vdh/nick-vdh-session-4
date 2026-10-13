document.addEventListener("DOMContentLoaded", () => {
  const capabilitiesList = document.getElementById("capabilities-list");
  const capabilitySelect = document.getElementById("capability");
  const registerForm = document.getElementById("register-form");
  const messageDiv = document.getElementById("message");

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => messageDiv.classList.add("hidden"), 5000);
  }

  // Function to fetch capabilities from API
  async function fetchCapabilities() {
    try {
      const response = await fetch("/capabilities");
      const capabilities = await response.json();

      // Clear loading message
      capabilitiesList.innerHTML = "";
      capabilitySelect.innerHTML = '<option value="">-- Select a capability --</option>';

      // Populate capabilities list
      Object.entries(capabilities).forEach(([name, details]) => {
        const capabilityCard = document.createElement("div");
        capabilityCard.className = "capability-card";

        const legacyCapacity = details.capacity || 0;
        const currentConsultants = details.consultants ? details.consultants.length : 0;
        const availability = details.consultant_availability || {};
        const recordedConsultantCount = details.availability_recorded_count || 0;
        const individualAvailability = recordedConsultantCount > 0
          ? `${details.recorded_available_hours} hours/week recorded for ${recordedConsultantCount} of ${currentConsultants} consultants`
          : "Not recorded yet";

        // Create per-consultant availability controls.
        const consultantsHTML =
          details.consultants && details.consultants.length > 0
            ? `<div class="consultants-section">
              <h5>Registered Consultants:</h5>
              <ul class="consultants-list">
                ${details.consultants
                  .map((email) => {
                    const safeEmail = escapeHTML(email);
                    const safeName = escapeHTML(name);
                    const recordedHours = availability[email] ?? "";
                    return `<li class="consultant-row">
                      <span class="consultant-email">${safeEmail}</span>
                      <label class="availability-field">
                        <span>Hours/week</span>
                        <input class="availability-input" type="number" min="0" step="0.5" value="${recordedHours}" placeholder="Not set" aria-label="Available hours per week for ${safeEmail}" />
                      </label>
                      <div class="consultant-actions">
                        <button class="save-availability-btn" data-capability="${safeName}" data-email="${safeEmail}" type="button">Save</button>
                        <button class="delete-btn" data-capability="${safeName}" data-email="${safeEmail}" type="button" aria-label="Unregister ${safeEmail}">Remove</button>
                      </div>
                    </li>`;
                  })
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No consultants registered yet</em></p>`;

        capabilityCard.innerHTML = `
          <h4>${escapeHTML(name)}</h4>
          <p>${escapeHTML(details.description)}</p>
          <p><strong>Practice Area:</strong> ${escapeHTML(details.practice_area)}</p>
          <p><strong>Industry Verticals:</strong> ${details.industry_verticals ? details.industry_verticals.map(escapeHTML).join(', ') : 'Not specified'}</p>
          <p><strong>Individual availability:</strong> ${individualAvailability}</p>
          <p><strong>Legacy team capacity:</strong> ${legacyCapacity} hours/week (existing capability-level figure)</p>
          <p><strong>Current Team:</strong> ${currentConsultants} consultants</p>
          <div class="consultants-container">
            ${consultantsHTML}
          </div>
        `;

        capabilitiesList.appendChild(capabilityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        capabilitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
      document.querySelectorAll(".save-availability-btn").forEach((button) => {
        button.addEventListener("click", handleAvailabilityUpdate);
      });
    } catch (error) {
      capabilitiesList.innerHTML =
        "<p>Failed to load capabilities. Please try again later.</p>";
      console.error("Error fetching capabilities:", error);
    }
  }

  async function handleAvailabilityUpdate(event) {
    const button = event.currentTarget;
    const capability = button.getAttribute("data-capability");
    const email = button.getAttribute("data-email");
    const input = button.closest(".consultant-row").querySelector(".availability-input");
    const availableHours = input.value.trim();

    if (availableHours === "" || !Number.isFinite(Number(availableHours)) || Number(availableHours) < 0) {
      showMessage("Enter a non-negative number of available hours per week.", "error");
      input.focus();
      return;
    }

    try {
      const response = await fetch(
        `/capabilities/${encodeURIComponent(capability)}/consultants/availability?email=${encodeURIComponent(email)}&available_hours=${encodeURIComponent(availableHours)}`,
        { method: "PUT" }
      );
      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "An error occurred", "error");
        return;
      }

      showMessage(result.message, "success");
      fetchCapabilities();
    } catch (error) {
      showMessage("Failed to update availability. Please try again.", "error");
      console.error("Error updating availability:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const capability = button.getAttribute("data-capability");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/capabilities/${encodeURIComponent(
          capability
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh capabilities list to show updated consultants
        fetchCapabilities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const capability = document.getElementById("capability").value;
    const availableHours = document.getElementById("available-hours").value;

    try {
      const response = await fetch(
        `/capabilities/${encodeURIComponent(
          capability
        )}/register?email=${encodeURIComponent(email)}&available_hours=${encodeURIComponent(availableHours)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        registerForm.reset();

        // Refresh capabilities list to show updated consultants
        fetchCapabilities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to register. Please try again.", "error");
      console.error("Error registering:", error);
    }
  });

  // Initialize app
  fetchCapabilities();
});
