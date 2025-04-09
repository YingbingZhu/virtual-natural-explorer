import '../css/styles.css';
import '../css/quiz.css';

// Utility: Decode HTML entities
function decodeHTML(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}

// Starts the quiz
export function startQuiz() {
    resetQuizProgress();
    document.getElementById("quiz-container").innerHTML = `<p>Loading quiz...</p>`;

    fetch("https://opentdb.com/api.php?amount=5&category=27&type=multiple&difficulty=easy")
        .then(res => res.json())
        .then(data => {
            const questions = data.results;
            let quizHTML = `<div class="score-tracker"><p>Score: <span id="current-score">0</span> / 5</p></div>`;

            questions.forEach((q, index) => {
                const question = decodeHTML(q.question);
                const correct = decodeHTML(q.correct_answer);
                const incorrects = q.incorrect_answers.map(decodeHTML);
                const options = [...incorrects, correct].sort(() => Math.random() - 0.5);

                quizHTML += `
                    <div class="quiz-question">
                        <p><strong>Q${index + 1}: ${question}</strong></p>
                        <div class="options-container">
                            ${options.map(opt => `
                                <button class="quiz-option" 
                                    data-answer="${correct.replace(/'/g, "&apos;")}"
                                >${opt}</button>
                            `).join("")}
                        </div>
                    </div>`;
            });

            quizHTML += `
                <div class="score-container" style="display: none;">
                    <p>Your Final Score: <span id="final-score">0</span>/5</p>
                    <button id="retry-btn">Try Again</button>
                </div>`;

            const container = document.getElementById("quiz-container");
            container.innerHTML = quizHTML;

            container.addEventListener("click", (e) => {
                if (e.target.classList.contains("quiz-option")) {
                    checkAnswer(e.target, e.target.dataset.answer);
                } else if (e.target.id === "retry-btn") {
                    startQuiz();
                }
            });
        })
        .catch(err => {
            console.error("Error loading quiz:", err);
            document.getElementById("quiz-container").innerHTML = `
                <p>Error loading quiz. Please try again later.</p>
                <button onclick="startQuiz()">Retry</button>`;
        });
}

// Track quiz progress
let answeredQuestions = 0;
let correctAnswers = 0;

// Handle answer check
function checkAnswer(button, correctAnswer) {
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

    if (button.innerText === correctAnswer) correctAnswers++;
    answeredQuestions++;

    document.getElementById("current-score").textContent = correctAnswers;

    if (answeredQuestions === 5) {
        setTimeout(() => {
            document.querySelector(".score-container").style.display = "block";
            document.getElementById("final-score").textContent = correctAnswers;
        }, 1000);
    }
}

function resetQuizProgress() {
    answeredQuestions = 0;
    correctAnswers = 0;
}

// Auto-start quiz on DOM ready (replaces quiz-main.js)
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("quiz-container")) {
        startQuiz();
    }
});


document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("quiz-container");
    const startBtn = document.getElementById("start-quiz-btn");

    if (startBtn && container) {
        startBtn.addEventListener("click", () => {
            startQuiz();
        });
    } else if (container) {
        // Auto start if button doesn't exist (maybe user came from another page)
        startQuiz();
    }
});