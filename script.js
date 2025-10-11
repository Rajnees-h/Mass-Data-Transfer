// Server URL is now managed in config.js (public/JsHelper/config.js)
const SERVER_URL = CONFIG.serverUrl;




function openOAuthPopup(authUrl, orgType) {
  // Open a blank popup
  const popup = window.open("", "_blank", "width=500,height=600");

  // Navigate the popup to the Salesforce OAuth URL
  popup.location.href = authUrl;

  // Listen for message from backend (if using postMessage in future)
  window.addEventListener("message", (event) => {
    if (event.data.status === "connected" && event.data.org === orgType) {
      const messageEl = document.getElementById("serverMessage");
      messageEl.innerText = `${orgType.toUpperCase()} Org connected successfully!`;
      popup.close();
    }
  });
}





async function connectOrg(type) {

    const statusLabel = document.getElementById(type === "source" ? "sourceStatus" : "targetStatus");


  const domainInput = document.getElementById(type === 'source' ? 'sourceDomain' : 'targetDomain');
  const domain = domainInput.value.trim();

  if (!domain) {
    alert("Please enter a domain URL");
    return;
  }

  try {
    const response = await fetch(`${SERVER_URL}/auth/start?domain=${encodeURIComponent(domain)}&type=${type}`);
    const data = await response.json();

    if (data.authUrl) {
        // Open a popup for OAuth
        const popup = window.open(data.authUrl, "_blank", "width=500,height=600");

    window.addEventListener("message", (event) => {
        if (event.data.status === "connected" && event.data.org === type) {
            statusLabel.textContent = "Status: ✅ Connected";
            statusLabel.style.color = "green";
            popup.close();
        }
        });

    } else {
      alert("Failed to start authentication");
    }
  } catch (error) {
    alert("Error: " + error.message);
  }
}

async function fetchServerMessage() {
  try {
    const response = await fetch(`${SERVER_URL}/`);
    const text = await response.text(); // since backend returns plain text
    document.getElementById("backendServerStatus").innerText = text;
  } catch (error) {
    console.error("Error fetching server message:", error);
    document.getElementById("backendServerStatus").innerText = "Failed to fetch message";
  }
}

document.getElementById("connectSource").addEventListener("click", () => connectOrg("source"));
document.getElementById("connectTarget").addEventListener("click", () => connectOrg("target"));
fetchServerMessage();
