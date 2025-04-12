// --------------------------------------------------
// Imports & CSS
// --------------------------------------------------
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import '../css/styles.css';
import '../css/map.css';
import '../css/chat.css';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// --------------------------------------------------
// Map Initialization
// --------------------------------------------------
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

// Load animal markers
fetch('data/animals.json')
  .then(res => res.json())
  .then(data => {
    data.regions.forEach(region => {
      createIconicMarker(region.iconic);
      region.detailed.forEach(animal => createDetailedMarker(animal));
    });
    toggleMarkers();
  });

const createIconicMarker = animal => {
  const marker = L.marker([animal.coordinates[1], animal.coordinates[0]], {
    icon: L.icon({
      iconUrl: animal.image,
      iconSize: animal.iconSize,
      iconAnchor: [animal.iconSize[0] / 2, animal.iconSize[1] / 2],
    }),
  }).on('click', () => openChatPopup(animal.name));
  iconicMarkers.push(marker);
  marker.addTo(map);
};

const createDetailedMarker = animal => {
  const marker = L.marker([animal.coordinates[1], animal.coordinates[0]], {
    icon: L.icon({
      iconUrl: animal.image,
      iconSize: animal.iconSize,
      iconAnchor: [animal.iconSize[0] / 2, animal.iconSize[1] / 2],
    }),
  }).bindPopup(`<b>${animal.name}</b>`);
  detailedMarkers.push(marker);
  marker.addTo(map);
};

const toggleMarkers = () => {
  const zoom = map.getZoom();
  const showIconic = zoom < 3;
  iconicMarkers.forEach(marker => {
    const el = marker.getElement?.();
    if (el) el.style.display = showIconic ? 'block' : 'none';
  });
  detailedMarkers.forEach(marker => {
    const el = marker.getElement?.();
    if (el) el.style.display = showIconic ? 'none' : 'block';
  });
};
map.on('zoomend', toggleMarkers);

// --------------------------------------------------
// Chat & Quiz Functions
// --------------------------------------------------

// Global chat history object per animal.
let chatHistory = {};
// global tracker
let lastMessageWasQuiz = false;

// Opens the chat popup for the given animal.
const openChatPopup = animalName => {
  lastMessageWasQuiz = false;
  const chatPopup = document.getElementById('chat-popup');
  const title = document.getElementById('chat-title');
  const chatContainer = document.getElementById('chat-container');
  const chatForm = document.getElementById('chat-form');

  chatPopup.style.display = 'block';
  title.textContent = `Chat with ${animalName}`;
  // Start with a welcoming message.
  chatContainer.innerHTML = `<p><strong>${animalName}:</strong> Hello! Ask me anything.</p>`;
  document.getElementById('close-popup').onclick = closeChatPopup;
  
  chatForm.onsubmit = event => {
    event.preventDefault();
    sendMessage(animalName);
  };
};

// Closes the chat popup.
const closeChatPopup = () =>
  (document.getElementById('chat-popup').style.display = 'none');

// Removes any JSON block (e.g., markdown code fences) from a string.
const removeJsonBlock = text =>
  text.replace(/.*```json[\s\S]*?```/, '').trim();

// parseQuizResponse – extracts a quiz JSON object, and validates required keys.
const parseQuizResponse = text => {
  // Match the JSON block only inside fenced markdown
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match || !match[1]) {
    return null;
  }

  const jsonString = match[1].trim();

  try {
    const quizObj = JSON.parse(jsonString);

    const hasRequiredFields = quizObj &&
      (typeof quizObj.id === 'string' || typeof quizObj.id === 'number') &&
      typeof quizObj.question === 'string' &&
      Array.isArray(quizObj.options) &&
      quizObj.options.every(opt => typeof opt === 'string') &&
      typeof quizObj.correctAnswer === 'string' &&
      typeof quizObj.explanation === 'string';

    if (!hasRequiredFields) {
      console.warn('Quiz JSON missing required fields:', quizObj);
      return null;
    }

    return quizObj;
  } catch (err) {
    console.error('JSON parse error:', err, '\nRaw JSON block:\n', jsonString);
    return null;
  }
};

// Saves quiz question/response data to localStorage under "quizResponses".
const saveQuizData = quizData => {
  // Ensure the quizData.id is always stored as a string.
  const normalizedId = String(quizData.id);
  quizData.id = normalizedId;

  const storedQuizzes = JSON.parse(localStorage.getItem("quizResponses")) || [];
  const existingIndex = storedQuizzes.findIndex(q => String(q.id) === normalizedId);
  if (existingIndex >= 0) {
    // Merge new data into the existing record.
    storedQuizzes[existingIndex] = { ...storedQuizzes[existingIndex], ...quizData };
  } else {
    storedQuizzes.push(quizData);
  }
  localStorage.setItem("quizResponses", JSON.stringify(storedQuizzes));
};

// Displays the quiz UI (always using the parser output) alongside the chat.
const displayQuiz = (quizQuestion, animalName) => {
  const chatContainer = document.getElementById('chat-container');
  let optionsHtml = '';
  quizQuestion.options.forEach(option => {
    optionsHtml += `<button onclick="handleQuizAnswer('${quizQuestion.id}', '${option}', '${quizQuestion.correctAnswer}', \`${quizQuestion.explanation}\`, '${animalName}')">${option}</button> `;
  });
  chatContainer.innerHTML += `
    <div id="quiz-${quizQuestion.id}">
      <p><strong>Quiz:</strong> ${quizQuestion.question}</p>
      <p>${optionsHtml}</p>
    </div>
  `;
};

// Handles quiz answer responses.
const handleQuizAnswer = (questionId, selectedOption, correctAnswer, explanation, animalName) => {
  const quizDiv = document.getElementById(`quiz-${questionId}`);
  const isCorrect = selectedOption === correctAnswer;

  if (isCorrect) {
    setAffectionLevel(animalName, getAffectionLevel(animalName) + 5);
  } else {
    setAffectionLevel(animalName, getAffectionLevel(animalName) + 1);
  }

  // Feedback only — no explanation here.
  const feedback = isCorrect
    ? '<p><strong>✅ Correct!</strong></p>'
    : `<p><strong>❌ Incorrect.</strong></p>`;
  quizDiv.innerHTML += feedback;

  const quizResponseData = {
    id: questionId,
    userAnswer: selectedOption,
    correctAnswer: correctAnswer,
    result: isCorrect ? 'Correct' : 'Incorrect',
    explanation: explanation,
    answeredAt: Date.now(),
  };
  saveQuizData(quizResponseData);

  if (!chatHistory[animalName]) chatHistory[animalName] = [];
  chatHistory[animalName].push({
    role: 'user',
    content: `Answered quiz "${questionId}": Selected "${selectedOption}", which is ${isCorrect ? 'correct' : 'incorrect'}.`
  });

  // Reply includes explanation ONLY if incorrect.
  const animalReply = isCorrect 
    ? "Great job! Feel free to ask me anything else!" 
    : `Good try! ${explanation}`;
  
  chatHistory[animalName].push({ role: 'assistant', content: animalReply });

  // Show in chat
  document.getElementById('chat-container').innerHTML += `<p><strong>${animalName}:</strong> ${animalReply}</p>`;
};

function getAffectionLevel(animalName) {
  const stored = JSON.parse(localStorage.getItem("animalAffection")) || {};
  return stored[animalName] || 0;
}

function setAffectionLevel(animalName, value) {
  const stored = JSON.parse(localStorage.getItem("animalAffection")) || {};
  stored[animalName] = Math.min(100, value); // Cap at 100
  localStorage.setItem("animalAffection", JSON.stringify(stored));
}

// Sends the user's message to the AI, displays the response, and (randomly or explicitly) inserts a quiz.
const sendMessage = async animalName => {
  const userInputField = document.querySelector('#chat-form input');
  const userInput = userInputField.value.trim();
  const chatContainer = document.getElementById('chat-container');

  if (!userInput) {
    chatContainer.innerHTML += `<p><strong>Error:</strong> Please enter a valid question.</p>`;
    return;
  }

  // Append the user's message
  chatContainer.innerHTML += `<p><strong>You:</strong> ${userInput}</p>`;

  // Affection +1 for every message
  const currentAffection = getAffectionLevel(animalName);
  setAffectionLevel(animalName, currentAffection + 1);

  userInputField.value = '';
  userInputField.focus();

  try {
    const aiResponse = await fetchOpenAIResponse(animalName, userInput);
    console.log("🔥 Raw AI response:\n", aiResponse);

    const quizData = parseQuizResponse(aiResponse);
    const userWantsQuiz = /quiz|test|question/i.test(userInput);
    const shouldShowQuiz = quizData && (!lastMessageWasQuiz || userWantsQuiz);

    // Show clean assistant response (if not only a quiz)
    const cleanResponse = removeJsonBlock(aiResponse);
    if (!quizData) {
      const lastMessage = chatContainer.lastElementChild?.textContent || '';
      if (!lastMessage.includes(cleanResponse)) {
        chatContainer.innerHTML += `<p><strong>${animalName}:</strong> ${cleanResponse}</p>`;
      }
    }

    // Show the quiz (once)
    if (shouldShowQuiz) {
      saveQuizData({ ...quizData, animal: animalName, timestamp: Date.now() });
      displayQuiz(quizData, animalName);
      lastMessageWasQuiz = true;
    } else {
      lastMessageWasQuiz = false;
    }

  } catch (error) {
    chatContainer.innerHTML += `<p><strong>Error:</strong> ${error.message}</p>`;
  }

  chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
};



// Fetches the AI response from your server-side proxy using conversation history.
const fetchOpenAIResponse = async (animal, userInput) => {
  try {
    if (!chatHistory[animal]) {
      chatHistory[animal] = [
        {
          role: 'system',
          content: `You are a talking ${animal}, who stays in character at all times.
            - NEVER send a quiz JSON unless the user clearly consents (e.g., by saying "yes", "sure", or "okay") after being asked.
            - DO NOT include a quiz in your first or second message, even if the user says "hi" or "tell me something".
            - You may OFFER a quiz with a 30% chance during conversation, phrased naturally (e.g., "Would you like a quiz about ${animal}s?").
            - Only if the user explicitly agrees (e.g., "yes", "okay", "sure", "quiz please") should you respond with a quiz.
            - When sending a quiz, reply with a brief intro sentence followed by EXACTLY one properly formatted JSON object within a markdown code block like this:

              \`\`\`json
              {
                "id": "lion-001",
                "question": "What is the average lifespan of a lion in the wild?",
                "options": ["5-7 years", "10-14 years", "15-20 years", "25-30 years"],
                "correctAnswer": "10-14 years",
                "explanation": "In the wild, lions typically live around 10 to 14 years. In captivity, they can live longer."
              }
              \`\`\`
            - Always acknowledge user responses briefly before moving forward.
            - DO NOT send any commentary after the quiz block. Only the intro + quiz JSON.
            - Confirm quiz answers clearly, without repeating full explanations.
            - Keep quiz topics strictly related to ${animal}s.
            - Do not send quizzes consecutively. Wait for user to ask again.
            - Keep responses short, friendly, and conversational.
            - Do NOT mention that you are an AI.`
        }
      ];
    }
    chatHistory[animal].push({ role: 'user', content: userInput });
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: chatHistory[animal],
        temperature: 0.7,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message || `API request failed with status ${response.status}`);
    }
    const aiResponse = result.choices[0]?.message?.content || "I'm not sure how to respond to that.";
    chatHistory[animal].push({ role: 'assistant', content: aiResponse });
    return aiResponse;
  } catch (error) {
    console.error('Proxy API Call Error:', error);
    return "Sorry, I couldn't generate a response right now.";
  }
};

// --------------------------------------------------
// Auto-Start Chat / Quiz on DOM Ready
// --------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const chatContainer = document.getElementById('chat-container');
  const startQuizBtn = document.getElementById('start-quiz-btn');

  if (startQuizBtn && chatContainer) {
    startQuizBtn.addEventListener('click', startQuiz);
  } else if (document.getElementById('quiz-container')) {
    // If on a dedicated quiz page, auto-start the quiz.
    startQuiz();
  }
});

// Expose functions globally.
window.openChatPopup = openChatPopup;
window.handleQuizAnswer = handleQuizAnswer;
window.sendMessage = sendMessage;
window.closeChatPopup = closeChatPopup;
