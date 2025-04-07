import * as maptilersdk from '@maptiler/sdk';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import '../css/styles.css';
import '../css/map.css';
import '../css/chat.css';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const map = L.map('map').setView([0, 20], 2);

L.tileLayer(`https://api.maptiler.com/maps/basic-v2/256/{z}/{x}/{y}.png?key=${process.env.MAPTILER_API_KEY}`, {
  attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a>',
}).addTo(map);

const iconicMarkers = [];
const detailedMarkers = [];

fetch('data/animals.json')
  .then(res => res.json())
  .then(data => {
    data.regions.forEach(region => {
      createIconicMarker(region.iconic);
      region.detailed.forEach(animal => {
        createDetailedMarker(animal);
      });
    });

    toggleMarkers(); // initial toggle after loading
  });

function createIconicMarker(animal) {
  const marker = L.marker([animal.coordinates[1], animal.coordinates[0]], {
    icon: L.icon({
      iconUrl: animal.image,
      iconSize: animal.iconSize,
      iconAnchor: [animal.iconSize[0] / 2, animal.iconSize[1] / 2]
    })
  }).on('click', () => {
    openChatPopup(animal.name);
  });

  iconicMarkers.push(marker);
  marker.addTo(map);
}

function createDetailedMarker(animal) {
  const marker = L.marker([animal.coordinates[1], animal.coordinates[0]], {
    icon: L.icon({
      iconUrl: animal.image,
      iconSize: animal.iconSize,
      iconAnchor: [animal.iconSize[0] / 2, animal.iconSize[1] / 2]
    })
  }).bindPopup(`<b>${animal.name}</b>`);

  detailedMarkers.push(marker);
  marker.addTo(map);
}

function toggleMarkers() {
  const zoom = map.getZoom();
  const showIconic = zoom < 3;

  iconicMarkers.forEach(marker => {
    const el = marker.getElement?.();
    if (el) el.style.display = showIconic ? "block" : "none";
  });

  detailedMarkers.forEach(marker => {
    const el = marker.getElement?.();
    if (el) el.style.display = showIconic ? "none" : "block";
  });
}

map.on('zoomend', toggleMarkers);


/**
 * Opens the chat popup for the specified animal and initializes the conversation.
 *
 * @param {string} animalName - The name of the animal to chat with.
 */
function openChatPopup(animalName) {
    const chatPopup = document.getElementById("chat-popup");
    const title = document.getElementById("chat-title");
    const chatContainer = document.getElementById("chat-container");
    const chatForm = document.getElementById("chat-form");
    
    chatPopup.style.display = "block"; // Show chat popup
    title.textContent = `Chat with ${animalName}`;
    chatContainer.innerHTML = "";

    // set up close button
    document.getElementById("close-popup").onclick = closeChatPopup;

    chatContainer.innerHTML += `<p><strong>${animalName}:</strong> Hello! Ask me anything.</p>`;

    // Handle chat form submission
    chatForm.onsubmit = function (event) {
        event.preventDefault();
        sendMessage(animalName);
    };
}

/**
 * Sends the user's message to the AI and appends the AI's response.
 *
 * @param {string} animalName - The name of the animal to chat with.
 */
async function sendMessage(animalName) {
    const userInputField = document.querySelector("#chat-form input");
    const userInput = userInputField.value.trim();
    const chatContainer = document.getElementById("chat-container");

    if (!userInput) {
        chatContainer.innerHTML += `<p><strong>Error:</strong> Please enter a valid question.</p>`;
        return;
    }

    // Append User Message
    chatContainer.innerHTML += `<p><strong>You:</strong> ${userInput}</p>`;

    // Clear Input Field & Keep Focus
    userInputField.value = "";
    userInputField.focus();

    // Fetch AI Response
    try {
        const aiResponse = await fetchOpenAIResponse(animalName, userInput);
        chatContainer.innerHTML += `<p><strong>${animalName}:</strong> ${aiResponse}</p>`;
    } catch (error) {
        chatContainer.innerHTML += `<p><strong>Error:</strong> ${error.message}</p>`;
    }

    // Smooth Auto-Scroll to Latest Message
    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: "smooth" });
}

// Store conversation history
let chatHistory = {};

/**
 * Fetches the AI response from the server-side proxy using conversation history.
 *
 * @param {string} animal - The name of the animal to chat with.
 * @param {string} userInput - The user's input message.
 * @returns {Promise<string>} - A promise that resolves to the AI's response.
 */
async function fetchOpenAIResponse(animal, userInput) {
    try {
      // Prepare the conversation history (same as before)
      if (!chatHistory[animal]) {
        chatHistory[animal] = [
          { 
            role: "system", 
            content: `You are a talking ${animal}, staying in character as an AI wildlife expert.
                - Always acknowledge user responses before changing topics.
                - Confirm any quiz responses before introducing new information.
                - Keep quiz questions related to the current animal unless otherwise asked.
                - If the user asks an unrelated question, switch back to normal conversation.
                - Keep responses concise and engaging.
                - Do NOT mention that you are an AI.
            `
          }
        ];
      }
      chatHistory[animal].push({ role: "user", content: userInput });
  
      // Send the request to your server-side proxy
      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: chatHistory[animal],
          temperature: 0.7
        })
      });
  
      const result = await response.json();
  
      if (!response.ok) {
        throw new Error(result.error?.message || `API request failed with status ${response.status}`);
      }
  
      const aiResponse = result.choices[0]?.message?.content || `I'm not sure how to respond to that.`;
      chatHistory[animal].push({ role: "assistant", content: aiResponse });
      return aiResponse;
    } catch (error) {
      console.error("Proxy API Call Error:", error);
      return `Sorry, I couldn't generate a response right now.`;
    }
}

/**
 * Closes the chat popup by hiding the chat container.
 */
function closeChatPopup() {
    document.getElementById("chat-popup").style.display = "none";
}


// Expose functions to the global scope.
window.openChatPopup = openChatPopup;
window.sendMessage = sendMessage;
window.closeChatPopup = closeChatPopup;


