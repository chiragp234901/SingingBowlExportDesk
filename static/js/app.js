// ============================================================
// Singing Bowl Export Desk
// Step 2 - Lead Management
// ============================================================

let leads = [
  {
    id: 1,
    owner: "Sarah Miller",
    email: "sarah@example.com",
    phone: "+1 555-0101",
    country: "USA",
    source: "Google",
    score: 94,
    contacted: false,
  },

  {
    id: 2,
    owner: "Michael Brown",
    email: "michael@example.com",
    phone: "+44 20 7946 0123",
    country: "UK",
    source: "Website",
    score: 88,
    contacted: true,
  },

  {
    id: 3,
    owner: "Emma Wilson",
    email: "emma@example.com",
    phone: "+1 555-0188",
    country: "USA",
    source: "Google",
    score: 91,
    contacted: false,
  },

  {
    id: 4,
    owner: "Daniel Smith",
    email: "daniel@example.com",
    phone: "+61 2 9374 4000",
    country: "Australia",
    source: "PDF",
    score: 82,
    contacted: false,
  },

  {
    id: 5,
    owner: "Olivia Johnson",
    email: "olivia@example.com",
    phone: "+49 30 123456",
    country: "Germany",
    source: "Google",
    score: 76,
    contacted: true,
  },
];

// ============================================================
// DOM ELEMENTS
// ============================================================

const leadsTableBody = document.getElementById("leadsTableBody");
const leadSearch = document.getElementById("leadSearch");

// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  renderLeads();

  updateStatistics();

  console.log("Singing Bowl Export Desk loaded");
});

// ============================================================
// RENDER LEADS
// ============================================================

function renderLeads(searchTerm = "") {
  if (!leadsTableBody) {
    return;
  }

  const search = searchTerm.toLowerCase().trim();

  const filteredLeads = leads.filter((lead) => {
    if (!search) {
      return true;
    }

    return (
      lead.owner.toLowerCase().includes(search) ||
      lead.email.toLowerCase().includes(search) ||
      lead.phone.toLowerCase().includes(search) ||
      lead.country.toLowerCase().includes(search) ||
      lead.source.toLowerCase().includes(search)
    );
  });

  leadsTableBody.innerHTML = "";

  // No leads

  if (filteredLeads.length === 0) {
    leadsTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    No leads found.
                </td>
            </tr>
        `;

    return;
  }

  // Render each lead

  filteredLeads.forEach((lead) => {
    const row = document.createElement("tr");

    row.innerHTML = `

            <td>
                <strong>${escapeHtml(lead.owner)}</strong>
            </td>

            <td>
                ${escapeHtml(lead.email)}
            </td>

            <td>
                ${escapeHtml(lead.phone)}
            </td>

            <td>
                ${escapeHtml(lead.country)}
            </td>

            <td>
                <span class="source-badge">
                    ${escapeHtml(lead.source)}
                </span>
            </td>

            <td>
                <span class="score-badge ${getScoreClass(lead.score)}">
                    ${lead.score}
                </span>
            </td>

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

            <td>

                <div class="lead-actions">

                    <button
                        class="table-btn send-btn"
                        onclick="sendLead(${lead.id})"
                        ${lead.contacted ? "disabled" : ""}
                    >
                        ${lead.contacted ? "Sent" : "Send"}
                    </button>

                    <button
                        class="table-btn delete-btn"
                        onclick="deleteLead(${lead.id})"
                    >
                        Delete
                    </button>

                </div>

            </td>

        `;

    leadsTableBody.appendChild(row);
  });
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
// SEND LEAD
// ============================================================

function sendLead(id) {
  const lead = leads.find((item) => item.id === id);

  if (!lead) {
    return;
  }

  /*
        Email sending will be connected later.

        For now we simply simulate the action.
    */

  lead.contacted = true;

  renderLeads(leadSearch ? leadSearch.value : "");

  updateStatistics();

  console.log(`Email would be sent to ${lead.email}`);
}

// ============================================================
// DELETE LEAD
// ============================================================

function deleteLead(id) {
  const lead = leads.find((item) => item.id === id);

  if (!lead) {
    return;
  }

  const confirmed = confirm(`Delete ${lead.owner} from your leads?`);

  if (!confirmed) {
    return;
  }

  leads = leads.filter((item) => item.id !== id);

  renderLeads(leadSearch ? leadSearch.value : "");

  updateStatistics();
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
  if (score >= 90) {
    return "score-high";
  }

  if (score >= 80) {
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

const pdfFileInput = document.getElementById("pdfFile");

if (pdfFileInput) {
  pdfFileInput.addEventListener("change", async function () {
    const file = this.files[0];

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      alert("Please select a PDF file.");
      this.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/upload-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "PDF upload failed.");
      }

      console.log("PDF uploaded successfully:", data);

      alert(
        `PDF uploaded successfully!\n\n` +
          `File: ${data.filename}\n` +
          `Pages: ${data.pages}`,
      );
    } catch (error) {
      console.error("PDF upload error:", error);
      alert("Failed to upload PDF: " + error.message);
    }
  });
}
