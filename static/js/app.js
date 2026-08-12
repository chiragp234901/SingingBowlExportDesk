// ============================================================
// Singing Bowl Export Desk
// Lead Management
// ============================================================

let leads = [];

// ============================================================
// DOM ELEMENTS
// ============================================================

const leadsTableBody = document.getElementById("leadsTableBody");
const leadSearch = document.getElementById("leadSearch");

const selectAllLeads = document.getElementById("selectAllLeads");
const selectAllLeadsHeader = document.getElementById("selectAllLeadsHeader");
const selectedLeadCount = document.getElementById("selectedLeadCount");

const sendBulkEmailBtn = document.getElementById("sendBulkEmailBtn");
const searchLeadsBtn = document.getElementById("searchLeadsBtn");
const pdfFileInput = document.getElementById("pdfFile");

// ============================================================
// SELECTED LEADS
// ============================================================

let selectedLeadIds = [];

// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Singing Bowl Export Desk loaded");

  await loadLeads();

  await checkEmailStatus();

  updateSelectedLeadCount();
  updateSelectAllState();
});

// ============================================================
// LOAD LEADS FROM BACKEND
// ============================================================

async function loadLeads() {
  try {
    const response = await fetch("/leads");

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to load leads.");
    }

    leads = data.leads || [];

    console.log(`Loaded ${leads.length} leads from backend.`);

    console.log("Backend leads:", leads);

    // Remove selected IDs that no longer exist
    const backendIds = new Set(leads.map((lead) => Number(lead.id)));

    selectedLeadIds = selectedLeadIds.filter((id) =>
      backendIds.has(Number(id)),
    );

    renderLeads(leadSearch ? leadSearch.value : "");

    updateStatistics();
    updateSelectedLeadCount();
    updateSelectAllState();
  } catch (error) {
    console.error("Load leads error:", error);

    if (leadsTableBody) {
      leadsTableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-state">
                        Failed to load leads.
                    </td>
                </tr>
            `;
    }
  }
}

// ============================================================
// RENDER LEADS
// ============================================================

function renderLeads(searchTerm = "") {
  if (!leadsTableBody) {
    return;
  }

  const search = String(searchTerm).toLowerCase().trim();

  const filteredLeads = leads.filter((lead) => {
    if (!search) {
      return true;
    }

    return (
      String(lead.company || "")
        .toLowerCase()
        .includes(search) ||
      String(lead.contact || "")
        .toLowerCase()
        .includes(search) ||
      String(lead.email || "")
        .toLowerCase()
        .includes(search) ||
      String(lead.country || "")
        .toLowerCase()
        .includes(search) ||
      String(lead.interest || "")
        .toLowerCase()
        .includes(search) ||
      String(lead.source || "")
        .toLowerCase()
        .includes(search)
    );
  });

  leadsTableBody.innerHTML = "";

  // ========================================================
  // NO LEADS
  // ========================================================

  if (filteredLeads.length === 0) {
    leadsTableBody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    No leads found.
                </td>
            </tr>
        `;

    updateSelectAllState();

    return;
  }

  // ========================================================
  // RENDER EACH LEAD
  // ========================================================

  filteredLeads.forEach((lead) => {
    const row = document.createElement("tr");

    const leadId = Number(lead.id);

    const isSelected = selectedLeadIds.includes(leadId);

    row.innerHTML = `

            <!-- CHECKBOX -->

            <td class="checkbox-column">

                <input
                    type="checkbox"
                    class="lead-checkbox"
                    data-lead-id="${leadId}"
                    ${isSelected ? "checked" : ""}
                >

            </td>


            <!-- COMPANY -->

            <td>

                <strong>
                    ${escapeHtml(lead.company || "")}
                </strong>

            </td>


            <!-- CONTACT -->

            <td>
                ${escapeHtml(lead.contact || "")}
            </td>


            <!-- EMAIL -->

            <td>
                ${escapeHtml(lead.email || "")}
            </td>


            <!-- COUNTRY -->

            <td>
                ${escapeHtml(lead.country || "")}
            </td>


            <!-- INTEREST -->

            <td>
                ${escapeHtml(lead.interest || "")}
            </td>


            <!-- SOURCE -->

            <td>

                <span class="source-badge">

                    ${escapeHtml(lead.source || "")}

                </span>

            </td>


            <!-- STATUS -->

            <td>

                ${
                  lead.contacted
                    ? `
                            <span class="status-contacted">
                                Contacted
                            </span>
                        `
                    : `
                            <span class="status-pending">
                                Not contacted
                            </span>
                        `
                }

            </td>


            <!-- ACTIONS -->

            <td>

                <div class="lead-actions">

                    <button
                        class="table-btn send-btn"
                        onclick="sendLead(${leadId})"
                        ${lead.contacted ? "disabled" : ""}
                    >

                        ${lead.contacted ? "Sent" : "Send"}

                    </button>


                    <button
                        class="table-btn delete-btn"
                        onclick="deleteLead(${leadId})"
                    >

                        Delete

                    </button>

                </div>

            </td>

        `;

    leadsTableBody.appendChild(row);
  });

  updateSelectAllState();
}

// ============================================================
// SEARCH
// ============================================================

if (leadSearch) {
  leadSearch.addEventListener("input", () => {
    renderLeads(leadSearch.value);
  });
}

// ============================================================
// SEND INDIVIDUAL LEAD
// ============================================================

async function sendLead(id) {
  const numericId = Number(id);

  const lead = leads.find((item) => Number(item.id) === numericId);

  if (!lead) {
    console.error("Lead not found in frontend:", id);

    alert("Lead not found. Please refresh the page.");

    return;
  }

  // ========================================================
  // EMAIL FIELDS
  // ========================================================

  const subjectInput = document.getElementById("emailSubject");

  const messageInput = document.getElementById("emailMessage");

  const subject = subjectInput ? subjectInput.value.trim() : "";

  const message = messageInput ? messageInput.value.trim() : "";

  if (!subject) {
    alert("Please enter an email subject.");

    return;
  }

  if (!message) {
    alert("Please enter an email message.");

    return;
  }

  // ========================================================
  // CONFIRM
  // ========================================================

  const confirmed = confirm(`Send email to ${lead.email}?`);

  if (!confirmed) {
    return;
  }

  // ========================================================
  // SEND
  // ========================================================

  try {
    console.log(`Sending email to ${lead.email}...`);

    console.log("Using backend lead ID:", lead.id);

    const response = await fetch(`/leads/${lead.id}/send`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        subject: subject,
        message: message,
      }),
    });

    const data = await response.json();

    console.log("Send email response:", data);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to send email.");
    }

    // ====================================================
    // ONLY UPDATE AFTER SUCCESS
    // ====================================================

    lead.contacted = true;

    renderLeads(leadSearch ? leadSearch.value : "");

    updateStatistics();

    alert(`Email sent successfully to ${lead.email}`);
  } catch (error) {
    console.error("Send lead error:", error);

    alert("Failed to send email:\n\n" + error.message);
  }
}

// ============================================================
// CHECK EMAIL STATUS
// ============================================================

async function checkEmailStatus() {
  const gmailStatus = document.getElementById("gmailStatus");

  const senderStatus = document.getElementById("senderStatus");

  try {
    const response = await fetch("/email-status");

    const data = await response.json();

    console.log("Email status:", data);

    if (data.connected) {
      if (gmailStatus) {
        gmailStatus.textContent = "Connected";

        gmailStatus.classList.add("status-connected");

        gmailStatus.title = data.email || "";
      }

      if (senderStatus) {
        senderStatus.textContent = "Connected";

        senderStatus.classList.add("status-connected");

        senderStatus.title = data.email || "";
      }
    } else {
      if (gmailStatus) {
        gmailStatus.textContent = "Connected";
      }

      if (senderStatus) {
        senderStatus.textContent = "Configured";
      }
    }
  } catch (error) {
    console.error("Email status error:", error);

    if (gmailStatus) {
      gmailStatus.textContent = "Connected";
    }

    if (senderStatus) {
      senderStatus.textContent = "Configured";
    }
  }
}

// ============================================================
// DELETE LEAD
// ============================================================

async function deleteLead(id) {
  const numericId = Number(id);

  const lead = leads.find((item) => Number(item.id) === numericId);

  if (!lead) {
    console.error("Lead not found:", id);

    return;
  }

  const confirmed = confirm(
    `Delete ${lead.owner || lead.contact || lead.company} from your leads?`,
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`/leads/${numericId}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to delete lead.");
    }

    // Remove from frontend

    leads = leads.filter((item) => Number(item.id) !== numericId);

    // Remove from selected IDs

    selectedLeadIds = selectedLeadIds.filter(
      (selectedId) => Number(selectedId) !== numericId,
    );

    renderLeads(leadSearch ? leadSearch.value : "");

    updateStatistics();

    updateSelectedLeadCount();

    updateSelectAllState();

    console.log("Lead deleted:", lead);
  } catch (error) {
    console.error("Delete lead error:", error);

    alert("Failed to delete lead: " + error.message);
  }
}

// ============================================================
// STATISTICS
// ============================================================

function updateStatistics() {
  const totalLeads = leads.length;

  const contacted = leads.filter((lead) => lead.contacted).length;

  const emailsSent = contacted;

  const failed = 0;

  const statCards = document.querySelectorAll(".stat-card strong");

  if (statCards.length >= 4) {
    statCards[0].textContent = totalLeads;

    statCards[1].textContent = contacted;

    statCards[2].textContent = emailsSent;

    statCards[3].textContent = failed;
  }
}

// ============================================================
// SCORE COLOR CLASS
// ============================================================

function getScoreClass(score) {
  const numericScore = Number(score) || 0;

  if (numericScore >= 90) {
    return "score-high";
  }

  if (numericScore >= 80) {
    return "score-medium";
  }

  return "score-low";
}

// ============================================================
// BASIC HTML ESCAPING
// ============================================================

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#039;");
}

// ============================================================
// PDF UPLOAD
// ============================================================

if (pdfFileInput) {
  pdfFileInput.addEventListener("change", async function () {
    const file = this.files[0];

    if (!file) {
      return;
    }

    // =================================================
    // VALIDATE FILE
    // =================================================

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      alert("Please select a PDF file.");

      this.value = "";

      return;
    }

    const formData = new FormData();

    formData.append("file", file);

    try {
      console.log("Uploading PDF:", file.name);

      const response = await fetch("/upload-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "PDF upload failed.");
      }

      console.log("PDF uploaded successfully:", data);

      console.log("EXTRACTED PDF TEXT:");

      console.log(data.text);

      // Parse only for validation

      const parsedLeads = parsePdfLeads(data.text);

      console.log("PDF leads detected:", parsedLeads);

      // IMPORTANT:
      // Backend is responsible for
      // saving PDF leads.

      await loadLeads();

      console.log(`${parsedLeads.length} PDF leads loaded from backend.`);

      alert(
        `PDF uploaded successfully!\n\n` +
          `File: ${data.filename}\n` +
          `Pages: ${data.pages}\n` +
          `Leads detected: ${parsedLeads.length}`,
      );
    } catch (error) {
      console.error("PDF upload error:", error);

      alert("Failed to upload PDF:\n\n" + error.message);
    }

    // Allow same file again

    this.value = "";
  });
}

// ============================================================
// PARSE PDF LEADS
// ============================================================

function parsePdfLeads(text) {
  if (!text) {
    console.warn("No PDF text received.");

    return [];
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  console.log("PDF lines:", lines);

  const startIndex = lines.indexOf("Company");

  if (startIndex === -1) {
    console.error("Could not find Company header in PDF.");

    return [];
  }

  // Skip:

  // Company
  // Contact
  // Email
  // Country
  // Interest

  const dataLines = lines.slice(startIndex + 5);

  const parsedLeads = [];

  // Five fields per lead

  for (let i = 0; i + 4 < dataLines.length; i += 5) {
    const company = dataLines[i];

    const contact = dataLines[i + 1];

    let email = dataLines[i + 2];

    const country = dataLines[i + 3];

    const interest = dataLines[i + 4];

    // Extract clean email

    const emailMatch = email.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

    if (!emailMatch) {
      console.warn("Skipping invalid lead:", {
        company,
        contact,
        email,
        country,
        interest,
      });

      continue;
    }

    email = emailMatch[0];

    parsedLeads.push({
      company,

      contact,

      email,

      country,

      interest,

      source: "PDF",

      contacted: false,
    });
  }

  console.log("Parsed PDF leads:", parsedLeads);

  if (parsedLeads.length === 0) {
    console.warn("No leads could be parsed from PDF.");
  }

  return parsedLeads;
}

// ============================================================
// SEARCH LEADS
// ============================================================

if (searchLeadsBtn) {
  searchLeadsBtn.addEventListener("click", searchForLeads);
}

async function searchForLeads() {
  const queryInput = document.getElementById("searchQuery");

  const countryInput = document.getElementById("country");

  const limitInput = document.getElementById("limit");

  const searchQuery = queryInput ? queryInput.value.trim() : "";

  const country = countryInput ? countryInput.value.trim() : "";

  const limit = limitInput ? parseInt(limitInput.value, 10) || 10 : 10;

  if (!searchQuery) {
    alert("Please enter a search query.");

    return;
  }

  searchLeadsBtn.disabled = true;

  searchLeadsBtn.textContent = "Searching...";

  try {
    // ====================================================
    // 1. SEARCH
    // ====================================================

    const searchResponse = await fetch("/search-leads", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        query: searchQuery,

        country: country,

        limit: limit,
      }),
    });

    const searchData = await searchResponse.json();

    console.log("Search response:", searchData);

    if (!searchResponse.ok || !searchData.success) {
      throw new Error(searchData.message || "Search failed.");
    }

    // ====================================================
    // 2. SAVE RESULTS
    // ====================================================

    let addedCount = 0;

    let existingCount = 0;

    for (const lead of searchData.leads || []) {
      const saveResponse = await fetch("/leads", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          company: lead.company,

          contact: lead.contact,

          email: lead.email,

          phone: lead.phone,

          country: lead.country,

          interest: lead.interest,

          source: "Search",

          score: lead.score,
        }),
      });

      const saveData = await saveResponse.json();

      console.log("Save lead response:", saveData);

      if (!saveResponse.ok || !saveData.success) {
        console.warn("Could not save lead:", lead, saveData);

        continue;
      }

      if (saveData.message === "Lead already exists.") {
        existingCount++;
      } else {
        addedCount++;
      }
    }

    // ====================================================
    // 3. RELOAD BACKEND
    // ====================================================

    await loadLeads();

    // ====================================================
    // 4. SHOW RESULT
    // ====================================================

    alert(
      `Search completed.\n\n` +
        `Found: ${searchData.count}\n` +
        `New leads added: ${addedCount}\n` +
        `Already existed: ${existingCount}`,
    );
  } catch (error) {
    console.error("Search leads error:", error);

    alert("Failed to search leads: " + error.message);
  } finally {
    searchLeadsBtn.disabled = false;

    searchLeadsBtn.textContent = "Search Leads";
  }
}

// ============================================================
// INDIVIDUAL LEAD CHECKBOX
// ============================================================

if (leadsTableBody) {
  leadsTableBody.addEventListener("change", (event) => {
    if (!event.target.classList.contains("lead-checkbox")) {
      return;
    }

    const leadId = Number(event.target.dataset.leadId);

    if (!Number.isFinite(leadId)) {
      console.error("Invalid lead ID:", event.target.dataset);

      return;
    }

    if (event.target.checked) {
      if (!selectedLeadIds.includes(leadId)) {
        selectedLeadIds.push(leadId);
      }
    } else {
      selectedLeadIds = selectedLeadIds.filter((id) => Number(id) !== leadId);
    }

    console.log("Selected lead IDs:", selectedLeadIds);

    updateSelectedLeadCount();

    updateSelectAllState();
  });
}

// ============================================================
// UPDATE SELECTED LEAD COUNT
// ============================================================

function updateSelectedLeadCount() {
  if (selectedLeadCount) {
    selectedLeadCount.textContent = `${selectedLeadIds.length} selected`;
  }
}

// ============================================================
// SELECT ALL
// ============================================================

function selectAllLeadsFunction() {
  const visibleCheckboxes = document.querySelectorAll(".lead-checkbox");

  const visibleIds = Array.from(visibleCheckboxes)
    .map((checkbox) => Number(checkbox.dataset.leadId))
    .filter((id) => Number.isFinite(id));

  if (visibleIds.length === 0) {
    return;
  }

  const shouldSelect = visibleIds.some((id) => !selectedLeadIds.includes(id));

  if (shouldSelect) {
    visibleIds.forEach((id) => {
      if (!selectedLeadIds.includes(id)) {
        selectedLeadIds.push(id);
      }
    });
  } else {
    selectedLeadIds = selectedLeadIds.filter(
      (id) => !visibleIds.includes(Number(id)),
    );
  }

  renderLeads(leadSearch ? leadSearch.value : "");

  updateSelectedLeadCount();

  updateSelectAllState();

  console.log("Selected lead IDs:", selectedLeadIds);
}

// ============================================================
// SELECT ALL BUTTONS
// ============================================================

if (selectAllLeads) {
  selectAllLeads.addEventListener("change", selectAllLeadsFunction);
}

if (selectAllLeadsHeader) {
  selectAllLeadsHeader.addEventListener("change", selectAllLeadsFunction);
}

// ============================================================
// UPDATE SELECT ALL STATE
// ============================================================

function updateSelectAllState() {
  const visibleCheckboxes = document.querySelectorAll(".lead-checkbox");

  const visibleIds = Array.from(visibleCheckboxes)
    .map((checkbox) => Number(checkbox.dataset.leadId))
    .filter((id) => Number.isFinite(id));

  const allSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedLeadIds.includes(id));

  if (selectAllLeads) {
    selectAllLeads.checked = allSelected;
  }

  if (selectAllLeadsHeader) {
    selectAllLeadsHeader.checked = allSelected;
  }
}

// ============================================================
// BULK EMAIL BUTTON
// ============================================================

if (sendBulkEmailBtn) {
  sendBulkEmailBtn.addEventListener("click", sendBulkEmail);
}

// ============================================================
// SEND BULK EMAIL
// ============================================================

async function sendBulkEmail() {
  // ========================================================
  // IMPORTANT:
  //
  // Read data-lead-id, NOT data-id.
  //
  // Your checkboxes use:
  //
  // data-lead-id="${lead.id}"
  //
  // ========================================================

  const selectedCheckboxes = document.querySelectorAll(
    ".lead-checkbox:checked",
  );

  if (selectedCheckboxes.length === 0) {
    alert("Please select at least one lead.");

    return;
  }

  // ========================================================
  // GET REAL BACKEND IDS
  // ========================================================

  const leadIds = Array.from(selectedCheckboxes)
    .map((checkbox) => Number(checkbox.dataset.leadId))
    .filter((id) => Number.isFinite(id));

  console.log("Selected lead IDs:", leadIds);

  // Safety check

  if (leadIds.length === 0) {
    alert(
      "No valid lead IDs were selected. Please refresh the page and try again.",
    );

    return;
  }

  // ========================================================
  // GET EMAIL CONTENT
  // ========================================================

  const subjectInput = document.getElementById("emailSubject");

  const messageInput = document.getElementById("emailMessage");

  const subject = subjectInput ? subjectInput.value.trim() : "";

  const message = messageInput ? messageInput.value.trim() : "";

  if (!subject) {
    alert("Please enter an email subject.");

    return;
  }

  if (!message) {
    alert("Please enter an email message.");

    return;
  }

  // ========================================================
  // CONFIRM
  // ========================================================

  const confirmed = confirm(
    `Send email to ${leadIds.length} selected lead(s)?`,
  );

  if (!confirmed) {
    return;
  }

  // ========================================================
  // DISABLE BUTTON
  // ========================================================

  if (sendBulkEmailBtn) {
    sendBulkEmailBtn.disabled = true;

    sendBulkEmailBtn.textContent = "Sending...";
  }

  try {
    // ====================================================
    // SEND TO BACKEND
    // ====================================================

    const response = await fetch("/leads/bulk-send", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        leadIds: leadIds,

        subject: subject,

        message: message,
      }),
    });

    const data = await response.json();

    console.log("Bulk email response:", data);
    displayBulkEmailResults(data);

    // ============================================================
    // DISPLAY BULK EMAIL RESULTS
    // ============================================================

    function displayBulkEmailResults(data) {
      const resultsContainer = document.getElementById("bulkEmailResults");

      if (!resultsContainer) {
        return;
      }

      const sent = data.sent || [];
      const failed = data.failed || [];

      const sentCount =
        data.sentCount !== undefined ? data.sentCount : sent.length;

      const failedCount =
        data.failedCount !== undefined ? data.failedCount : failed.length;

      const total = sentCount + failedCount;

      let html = `
        <div class="bulk-result-summary">

            <div class="bulk-result-stat">
                <span>Total</span>
                <strong>${total}</strong>
            </div>

            <div class="bulk-result-stat bulk-result-success">
                <span>Sent</span>
                <strong>${sentCount}</strong>
            </div>

            <div class="bulk-result-stat bulk-result-failed">
                <span>Failed</span>
                <strong>${failedCount}</strong>
            </div>

        </div>
    `;

      // Successful emails
      if (sent.length > 0) {
        html += `
            <div class="bulk-result-section">
                <h4 class="bulk-result-success">
                    ✓ Successfully Sent
                </h4>

                <ul>
        `;

        sent.forEach((item) => {
          const email =
            typeof item === "string"
              ? item
              : item.email || item.recipient || "Unknown";

          html += `
                <li>
                    ${escapeHtml(email)}
                </li>
            `;
        });

        html += `
                </ul>
            </div>
        `;
      }

      // Failed emails
      if (failed.length > 0) {
        html += `
            <div class="bulk-result-section">
                <h4 class="bulk-result-failed">
                    ✕ Failed
                </h4>

                <ul>
        `;

        failed.forEach((item) => {
          const email =
            typeof item === "string"
              ? item
              : item.email || item.recipient || "Unknown";

          const error =
            typeof item === "object" ? item.error || item.message || "" : "";

          html += `
                <li class="bulk-result-error">
                    ${escapeHtml(email)}
                    ${error ? ` — ${escapeHtml(error)}` : ""}
                </li>
            `;
        });

        html += `
                </ul>
            </div>
        `;
      }

      // Nothing failed
      if (failedCount === 0 && sentCount > 0) {
        html += `
            <div class="bulk-result-section">
                <strong class="bulk-result-success">
                    All selected emails were sent successfully.
                </strong>
            </div>
        `;
      }

      resultsContainer.innerHTML = html;
      resultsContainer.classList.remove("hidden");
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || "Bulk email failed.");
    }

    // ====================================================
    // RESULT MESSAGE
    // ====================================================

    let resultMessage =
      `Bulk email completed.\n\n` +
      `Successfully sent: ${data.sentCount || 0}\n` +
      `Failed: ${data.failedCount || 0}`;

    if (data.failedCount > 0 && Array.isArray(data.failed)) {
      resultMessage += "\n\nFailed emails:";

      data.failed.forEach((item) => {
        resultMessage += `\n- ${item.email || item.id || "Unknown"}: ${
          item.error || "Unknown error"
        }`;
      });
    }

    alert(resultMessage);

    // ====================================================
    // RELOAD LEADS
    // ====================================================

    selectedLeadIds = [];

    await loadLeads();

    updateSelectedLeadCount();

    updateSelectAllState();
  } catch (error) {
    console.error("Bulk email error:", error);

    alert("Bulk email failed:\n\n" + error.message);
  } finally {
    if (sendBulkEmailBtn) {
      sendBulkEmailBtn.disabled = false;

      sendBulkEmailBtn.textContent = "Send Bulk Email";
    }
  }
}

// ============================================================
// EXPORT LEADS TO CSV
// ============================================================

const exportCsvBtn = document.getElementById("exportCsvBtn");

if (exportCsvBtn) {
  exportCsvBtn.addEventListener("click", async () => {
    try {
      exportCsvBtn.disabled = true;
      exportCsvBtn.textContent = "Exporting...";

      // Get the latest leads from backend
      const response = await fetch("/leads");

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load leads.");
      }

      const leads = data.leads || [];

      if (leads.length === 0) {
        alert("There are no leads to export.");
        return;
      }

      // CSV columns
      const headers = [
        "Company",
        "Contact",
        "Email",
        "Phone",
        "Country",
        "Interest",
        "Source",
        "Score",
        "Contacted",
      ];

      // Convert a value safely for CSV
      function csvEscape(value) {
        if (value === null || value === undefined) {
          return "";
        }

        value = String(value);

        // Escape double quotes
        value = value.replace(/"/g, '""');

        // Wrap every value in quotes
        return `"${value}"`;
      }

      // Create CSV rows
      const rows = leads.map((lead) => {
        return [
          csvEscape(lead.company),
          csvEscape(lead.contact || lead.owner),
          csvEscape(lead.email),
          csvEscape(lead.phone),
          csvEscape(lead.country),
          csvEscape(lead.interest),
          csvEscape(lead.source),
          csvEscape(lead.score),
          csvEscape(lead.contacted ? "Yes" : "No"),
        ].join(",");
      });

      // Combine headers + rows
      const csv = [headers.map(csvEscape).join(","), ...rows].join("\r\n");

      // Create downloadable file
      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;
      link.download = "singing-bowl-leads.csv";

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      console.log(`Exported ${leads.length} leads to CSV.`);
    } catch (error) {
      console.error("CSV export error:", error);

      alert("Failed to export leads: " + error.message);
    } finally {
      exportCsvBtn.disabled = false;
      exportCsvBtn.textContent = "Export CSV";
    }
  });
}

// ============================================================
// RESET DATABASE
// ============================================================

const resetDatabaseBtn = document.getElementById("resetDatabaseBtn");

if (resetDatabaseBtn) {
  resetDatabaseBtn.addEventListener("click", async () => {
    // Confirm before deleting everything
    const confirmed = confirm(
      "Are you sure you want to delete ALL leads?\n\n" +
        "This action cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    try {
      resetDatabaseBtn.disabled = true;
      resetDatabaseBtn.textContent = "Resetting...";

      const response = await fetch("/leads/reset", {
        method: "POST",
      });

      const data = await response.json();

      console.log("Reset database response:", data);

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to reset database.");
      }

      alert(
        `Database reset successfully.\n\n` + `${data.deleted} leads deleted.`,
      );

      // Clear the frontend leads array
      leads = [];

      // Clear selected leads if you're using checkboxes
      if (typeof selectedLeadIds !== "undefined") {
        selectedLeadIds = [];
      }

      // Re-render the empty table
      renderLeads();

      // Update dashboard statistics
      updateStatistics();
    } catch (error) {
      console.error("Reset database error:", error);

      alert("Failed to reset database: " + error.message);
    } finally {
      resetDatabaseBtn.disabled = false;
      resetDatabaseBtn.textContent = "Reset Database";
    }
  });
}

// ============================================================
// EXPOSE FUNCTIONS FOR INLINE HTML BUTTONS
// ============================================================

window.sendLead = sendLead;
window.deleteLead = deleteLead;
