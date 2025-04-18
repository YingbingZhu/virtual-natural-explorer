# Virtual Natural Explorer

An interactive web-based platform for exploring wildlife and ecosystems around the world. 
Features include a world map with AI-powered wildlife chatbot, quizzes, and interactive ecosystem simulation.

## Prerequisites
- **Node.js** v14 or higher  
- **npm** (comes bundled with Node.js)  

Verify your setup:

```bash
node --version   
npm --version
```

Install dependencies:

```bash
cd virtual-natural-explorer
npm install
```

## Environment Setup

Store your OpenAI API key in the backend .env file: `virtual-natural-explorer/backend/.env`

Example:
```
OPENAI_API_KEY=xxxxx
```
By adding this, the backend can access AI functionality.
---

## How to Start the Project
From the project root directory `virtual-natural-explorer/`
Type this command in terminal
```
npm start
```
This command will lauch both frontend and backend.
Now the web should be running on http://localhost:3400/

---

## Features
- World Map Explorer
- AI Wildlife Chatbot
- Interactive Ecosystem Simulation
- Animal Encyclopedia
- Quizzes
- Animal videos and AI-genrated stories

---

##  Dependencies

JavaScript (Vanilla)
HTML5 & CSS3
OpenAI API 
Leaflet
MapTiler

---

## Future Work

- Add User registration and login feature, and store data in database
- Fetch live animal data from open biodiversity
- Add ecosystem type setting (like desert, coral reef, tundra, etc.).
- Support Multiplayer or classroom mode for collaborative exploration.
- Mobile-optimized interface and offline mode.

---


