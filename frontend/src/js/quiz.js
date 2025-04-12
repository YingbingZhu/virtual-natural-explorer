import '../css/styles.css';
import '../css/quiz.css';

// --------------------------------------------------
// Utility Functions
// --------------------------------------------------

/**
 * Decodes HTML entities from a string.
 * @param {string} html - The HTML string.
 * @returns {string} - The decoded text.
 */
const decodeHTML = html => {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = html;
  return textarea.value;
};

/**
 * Retrieves unlocked quiz responses from localStorage.
 * @returns {Array} - An array of quiz objects.
 */
const getQuizResponses = () => JSON.parse(localStorage.getItem("quizResponses")) || [];

// --------------------------------------------------
// Quiz Progress Tracking
// --------------------------------------------------
let answeredQuestions = 0;
let correctAnswers = 0;

const resetQuizProgress = () => {
  answeredQuestions = 0;
  correctAnswers = 0;
};

// --------------------------------------------------
// Quiz HTML Builders
// --------------------------------------------------

/**
 * Generates the HTML for a single quiz question.
 * Filters out questions that do not have a valid options array.
 * @param {Object} q - The quiz question object.
 * @param {number} index - The question index.
 * @returns {string} - The HTML string for the quiz question.
 */
const createQuizQuestionHTML = (q, index) => {
  // Ensure that q.options is an array.
  if (!Array.isArray(q.options)) {
    console.error(`Quiz question at index ${index} does not have valid options:`, q);
    return "";
  }
  
  const questionText = decodeHTML(q.question);
  const correctAnswer = decodeHTML(q.correctAnswer);
  const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);

  return `
    <div class="quiz-question">
      <p><strong>Q${index + 1}: ${questionText}</strong></p>
      <div class="options-container">
        ${shuffledOptions
          .map(
            opt => `
          <button class="quiz-option" data-answer="${correctAnswer.replace(/'/g, "&apos;")}">
            ${decodeHTML(opt)}
          </button>
        `
          )
          .join("")}
      </div>
    </div>
  `;
};

/**
 * Builds the complete quiz HTML interface from valid quiz responses.
 * @param {Array} quizResponses - Array of unlocked quiz questions.
 * @returns {string} - The complete quiz HTML.
 */
const buildQuizHTML = (quizResponses) => {
  // Filter out any quiz items that do not have an iterable options array.
  const validQuizResponses = quizResponses.filter(q => Array.isArray(q.options));

  if (validQuizResponses.length === 0) {
    return `<p>No valid quiz questions found. Come chat with animals to unlock more quiz questions!</p>`;
  }

  let html = `
    <div class="score-tracker">
      <p>Score: <span id="current-score">0</span> / ${validQuizResponses.length}</p>
    </div>
  `;

  validQuizResponses.forEach((q, index) => {
    html += createQuizQuestionHTML(q, index);
  });

  html += `
    <div class="score-container" style="display: none;">
      <p>Your Final Score: <span id="final-score">0</span> / ${validQuizResponses.length}</p>
      <button id="retry-btn">Try Again</button>
    </div>
  `;
  return html;
};

// --------------------------------------------------
// Quiz Functionalities
// --------------------------------------------------

/**
 * Starts the quiz, using unlocked quiz questions from localStorage.
 */
export const startQuiz = () => {
  resetQuizProgress();
  const container = document.getElementById("quiz-container");
  const quizResponses = getQuizResponses();

  // If no unlocked quiz questions exist, show a friendly message.
  if (quizResponses.length === 0) {
    container.innerHTML = `<p>Come and chat with animals to unlock more quiz questions!</p>`;
    return;
  }

  container.innerHTML = buildQuizHTML(quizResponses);
};

/**
 * Checks the selected answer against the correct answer.
 * @param {HTMLElement} button - The clicked option button.
 * @param {string} correctAnswer - The correct answer.
 */
const checkAnswer = (button, correctAnswer) => {
  if (button.disabled) return;

  // Disable all buttons for this question.
  const buttons = button.parentElement.querySelectorAll("button");
  buttons.forEach(btn => {
    btn.disabled = true;
    if (btn.innerText === correctAnswer) {
      btn.classList.add("correct");
    } else if (btn === button) {
      btn.classList.add("incorrect");
    }
  });

  if (button.innerText === correctAnswer) correctAnswers++;
  answeredQuestions++;

  document.getElementById("current-score").textContent = correctAnswers;

  // Use the length of valid quiz responses (re-read from localStorage).
  const quizCount = getQuizResponses().filter(q => Array.isArray(q.options)).length;
  if (answeredQuestions === quizCount) {
    setTimeout(() => {
      document.querySelector(".score-container").style.display = "block";
      document.getElementById("final-score").textContent = correctAnswers;
    }, 1000);
  }
};

// --------------------------------------------------
// Event Listener for Quiz Container
// --------------------------------------------------

/**
 * Delegated event handler for quiz container clicks.
 * @param {Event} e - The event object.
 */
const handleQuizContainerClick = e => {
  const container = e.currentTarget;
  if (e.target.classList.contains("quiz-option")) {
    checkAnswer(e.target, e.target.dataset.answer);
  } else if (e.target.id === "retry-btn") {
    container.removeEventListener("click", handleQuizContainerClick);
    startQuiz();
  }
};

// --------------------------------------------------
// Auto-Start Quiz on DOM Ready
// --------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("quiz-container");
  const startBtn = document.getElementById("start-quiz-btn");

  if (startBtn && container) {
    startBtn.addEventListener("click", startQuiz);
  } else if (container) {
    startQuiz();
  }

  if (container) {
    container.addEventListener("click", handleQuizContainerClick);
  }
});

// --------------------------------------------------
// Data Management: Merged Save Function
// --------------------------------------------------
/**
 * Saves a quiz question or response to localStorage under "quizResponses".
 * If a record with the same ID already exists, it merges the new data into it.
 * This helps to keep each quiz question as a single record.
 * @param {Object} quizData - The quiz data object.
 */
const saveQuizData = quizData => {
  const storedQuizzes = JSON.parse(localStorage.getItem("quizResponses")) || [];
  const existingIndex = storedQuizzes.findIndex(q => q.id === quizData.id);
  if (existingIndex >= 0) {
    // Merge new data into existing record.
    storedQuizzes[existingIndex] = { ...storedQuizzes[existingIndex], ...quizData };
  } else {
    storedQuizzes.push(quizData);
  }
  localStorage.setItem("quizResponses", JSON.stringify(storedQuizzes));
};

// --------------------------------------------------
// Expose Functions Globally
// --------------------------------------------------
window.openChatPopup = openChatPopup;
window.handleQuizAnswer = (questionId, selectedOption, correctAnswer, explanation, animalName) => {
  const quizDiv = document.getElementById(`quiz-${questionId}`);
  const isCorrect = selectedOption === correctAnswer;
  const feedback = isCorrect
    ? '<p><strong>Correct!</strong></p>'
    : `<p><strong>Incorrect.</strong> ${explanation}</p>`;
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

  // Resume conversation naturally.
  document.getElementById('chat-container').innerHTML += `<p><strong>${animalName}:</strong> Feel free to ask me anything!</p>`;
};
window.sendMessage = sendMessage;
window.closeChatPopup = () => (document.getElementById('chat-popup').style.display = 'none');
