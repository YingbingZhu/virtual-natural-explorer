import '../css/styles.css';
import '../css/quiz.css';


let currentQuizSet = [];
let previousCorrectByAnimal = {};


/**
 * Decodes HTML entities from a string.
 * 
 * @param {string} html html string
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

let answeredQuestions = 0;
let correctAnswers = 0;

const resetQuizProgress = () => {
  answeredQuestions = 0;
  correctAnswers = 0;
};

/**
 * Generates the HTML for a single quiz question.
 * 
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
 * 
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


/**
 * Returns a shuffled random sample of `count` items from the array.
 * 
 * @param {Array} array - The full quiz pool.
 * @param {number} count - Number of items to sample.
 * @returns {Array}
 */
const getRandomSample = (array, count) => {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
};

/**
 * Starts the quiz, using unlocked quiz questions from localStorage.
 */
export const startQuiz = () => {
  resetQuizProgress();
  const container = document.getElementById("quiz-container");
  const allQuizzes = getQuizResponses();
  currentQuizSet = getRandomSample(allQuizzes, 5);
  const quizResponses = currentQuizSet;

  previousCorrectByAnimal = {};
  currentQuizSet.forEach(q => {
    if (q.animal && q.result === "Correct") {
      previousCorrectByAnimal[q.animal] = (previousCorrectByAnimal[q.animal] || 0) + 1;
    }
  });

  // If no unlocked quiz questions exist, show a friendly message.
  if (currentQuizSet.length === 0) {
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
  
    const buttons = button.parentElement.querySelectorAll("button");
    buttons.forEach(btn => {
      btn.disabled = true;
      if (btn.innerText === correctAnswer) {
        btn.classList.add("correct");
      } else if (btn === button) {
        btn.classList.add("incorrect");
      }
    });
  
    const isCorrect = button.innerText === correctAnswer;
    if (isCorrect) correctAnswers++;
    answeredQuestions++;
  
    document.getElementById("current-score").textContent = correctAnswers;
  
    // Identify the question object to save updated quiz result
    const questionText = button.closest(".quiz-question")?.querySelector("p strong")?.innerText || "";
    const quizResponses = getQuizResponses();
    const quizObj = quizResponses.find(q => questionText.includes(q.question));
  
    if (quizObj) {
      saveQuizData({
        ...quizObj,
        result: isCorrect ? "Correct" : "Incorrect",
        userAnswer: button.innerText,
        answeredAt: Date.now()
      });
    }
  
    const quizCount = currentQuizSet.length;
    if (answeredQuestions === quizCount) {
        setTimeout(() => {
            document.querySelector(".score-container").style.display = "block";
            document.getElementById("final-score").textContent = correctAnswers;
        
            showFamiliarityGains();
          }, 1000);
    }
  };

  function showFamiliarityGains() {
    const updated = getQuizResponses();
    const newCorrectByAnimal = {};
    const gainByAnimal = {};
  
    currentQuizSet.forEach(q => {
      if (!q.animal) return;
      const stored = updated.find(storedQ => storedQ.id === q.id);
      if (stored?.result === "Correct") {
        newCorrectByAnimal[q.animal] = (newCorrectByAnimal[q.animal] || 0) + 1;
      }
    });
  
    Object.keys(newCorrectByAnimal).forEach(animal => {
      const before = previousCorrectByAnimal[animal] || 0;
      const after = newCorrectByAnimal[animal];
      const diff = after - before;
      if (diff > 0) {
        gainByAnimal[animal] = diff;
      }
    });
  
    const container = document.querySelector(".score-container");
    const box = document.createElement("div");
    box.classList.add("familiarity-gains");
  
    if (Object.keys(gainByAnimal).length > 0) {
      let html = `<h4>🧠 Familiarity Gains</h4><ul>`;
      Object.entries(gainByAnimal).forEach(([animal, count]) => {
        html += `<li>You increased <strong>${count}</strong> more familiarity with <strong>${animal}</strong>.</li>`;
      });
      html += `</ul>`;
      box.innerHTML = html;
    } else {
      // Fallback message when no gain
      box.innerHTML = `
        <h4>📘 No New Gains Yet</h4>
        <p>Every try helps! Keep learning and chatting with the animals 🐾</p>
      `;
    }

    container.appendChild(box);

    const totalPossible = currentQuizSet.length;
    if (Object.keys(gainByAnimal).length > 0 || correctAnswers === totalPossible) {
    launchConfetti();
    }
  }

  function launchConfetti() {
    const duration = 2 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };
  
    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }
  
    const interval = setInterval(function () {
      const timeLeft = animationEnd - Date.now();
  
      if (timeLeft <= 0) {
        return clearInterval(interval);
      }
  
      const particleCount = 50 * (timeLeft / duration);
  
      confetti({
        particleCount,
        angle: randomInRange(55, 125),
        spread: 70,
        origin: { x: 0.5, y: 0.6 },
        ...defaults
      });
    }, 250);
  }
  
  
  
/**
 * Delegated event handler for quiz container clicks.
 * 
 * @param {Event} e - The event object.
 */
const handleQuizContainerClick = e => {
    const container = e.currentTarget;
    if (e.target.classList.contains("quiz-option")) {
      checkAnswer(e.target, e.target.dataset.answer);
    } else if (e.target.id === "retry-btn") {
      startQuiz();
    }
  };

/**
 * start quiz
 */
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

/**
 * Saves a quiz question or response to localStorage under "quizResponses".
 * If a record with the same ID already exists, it merges the new data into it.
 * 
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

