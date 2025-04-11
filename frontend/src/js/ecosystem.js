
import '../css/styles.css';
import '../css/ecosystem.css';

/* --------------------------- */
/* HUMAN IMPACT ZONE CLASS     */
/* --------------------------- */
class HumanImpactZone {
  constructor(x, y, type, radius = 60) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = radius;
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
    ctx.fillStyle = {
      pollution: "rgba(128,128,128,0.3)",
      deforestation: "rgba(160,82,45,0.3)",
      conservation: "rgba(0,255,0,0.3)"
    }[this.type];
    ctx.fill();
  
    // Draw emoji in the center
    const emoji = {
      pollution: "💨",
      deforestation: "🪓",
      conservation: "🌱"
    }[this.type];
  
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "black"; 
    ctx.fillText(emoji, this.x, this.y);
  }
  

  affectEntity(entity) {
    const dist = Math.hypot(this.x - entity.x, this.y - entity.y);
    if (dist > this.radius) return;

    const intensity = 0.1;
    if (this.type === "pollution" && entity.type !== "plant") {
      entity.energy -= intensity * 5;
    } else if (this.type === "deforestation" && entity.type === "plant") {
      if (Math.random() < 0.2) entity.health = 0;
    } else if (this.type === "conservation") {
      if (entity.type === "plant") entity.health = Math.min(100, entity.health + 0.1);
      else entity.energy = Math.min(100, entity.energy + 0.2);
    }
  }
}

/* --------------------------- */
/* ENTITY CLASS                */
/* --------------------------- */
class Entity {
  constructor(x, y, type, emoji) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.emoji = emoji;
    this.energy = type === 'plant' ? 0 : 50 + Math.random() * 50;
    this.health = type === 'plant' ? 100 : 0;
    this.growthTimer = 0; // for grass
    this.speed = type === 'predator'
      ? 1.5
      : type === 'prey'
        ? 1.5 + Math.random() * 0.5
        : 0;
  }

  move(sim) {
    if (this.type === 'plant') {
      this.updateGrass(sim);
    } else if (this.energy > 0) {
      this.type === 'prey' ? this.preyLogic(sim) : this.predatorLogic(sim);
    }
    this.x = Math.max(0, Math.min(sim.canvas.width, this.x));
    this.y = Math.max(0, Math.min(sim.canvas.height, this.y));
  }

  updateGrass(sim) {
    if (this.health <= 0) {
      this.growthTimer++;
      if (this.growthTimer > sim.settings.grassRegrowTime) {
        this.health = 100;
        this.growthTimer = 0;
      }
    }
  }

  preyLogic(sim) {
    this.x += (Math.random() - 0.5) * this.speed;
    this.y += (Math.random() - 0.5) * this.speed;

    const grass = sim.entities.find(e =>
      e.type === 'plant' &&
      e.health > 0 &&
      Math.hypot(this.x - e.x, this.y - e.y) < sim.preyPlantRange
    );
    if (grass) {
      grass.health = 0;
      this.energy += sim.settings.sheepGainFromFood;
      sim.updateInfo("Sheep ate grass!");
    }

    this.energy -= 1;

    if (this.energy > 30 && Math.random() < sim.settings.sheepReproduceProb) {
      sim.entities.push(new Entity(this.x + 10, this.y + 10, 'prey', this.emoji));
      this.energy /= 2;
      sim.updateInfo("A sheep was born!");
    }
  }

  predatorLogic(sim) {
    let target = null;
    let minDist = Infinity;
    sim.entities.forEach(e => {
      if (e.type === 'prey') {
        const d = Math.hypot(this.x - e.x, this.y - e.y);
        if (d < minDist) {
          minDist = d;
          target = e;
        }
      }
    });

    if (target) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;

      if (minDist < 10) {
        sim.entities = sim.entities.filter(e => e !== target);
        this.energy += sim.settings.wolfGainFromFood;
        sim.updateInfo("A wolf ate a sheep!");
      }
    } else {
      this.x += (Math.random() - 0.5) * this.speed;
      this.y += (Math.random() - 0.5) * this.speed;
    }

    this.energy -= 1.5;

    if (this.energy > 40 && Math.random() < sim.settings.wolfReproduceProb) {
      sim.entities.push(new Entity(this.x + 10, this.y + 10, 'predator', this.emoji));
      this.energy /= 2;
      sim.updateInfo("A wolf was born!");
    }
  }

  draw(ctx) {
    ctx.font = '30px Arial';
    ctx.fillText(this.emoji, this.x, this.y);

    if (this.type === 'plant') {
      ctx.fillStyle = this.health > 0 ? 'green' : 'gray';
      ctx.fillRect(this.x, this.y + 20, 25, 5);
    } else {
      ctx.fillStyle = this.energy > 40 ? 'green' : 'red';
      ctx.fillRect(this.x, this.y - 10, this.energy / 4, 5);
    }
  }
}

/* --------------------------- */
/* SIMULATION CLASS            */
/* --------------------------- */
class Simulation {
  constructor() {
    // Canvas setup for ecosystem simulation
    this.canvas = document.getElementById('ecosystemCanvas');
    if (!this.canvas) {
      console.error('Canvas element not found!');
      return;
    }
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = 800;
    this.canvas.height = 500;

    // Canvas for the population graph (assumes a separate canvas exists)
    this.graphCanvas = document.getElementById('populationGraph');
    if (this.graphCanvas) {
      this.graphCtx = this.graphCanvas.getContext('2d');
      this.graphCanvas.width = 400;
      this.graphCanvas.height = 200;
    }
    // 
    this.settings = {
      sheepGainFromFood: 4,
      wolfGainFromFood: 20,
      sheepReproduceProb: 0.04,
      wolfReproduceProb: 0.05,
      grassRegrowTime: 30 // optional if you want regrowth
    };

    // Simulation state variables
    this.entities = [];
    this.weather = 'sunny';
    this.simulationRunning = false;
    this.simulationDelay = 400; // default speed (can be modified via slider)
    this.raindrops = [];
    this.snowflakes = [];
    this.lightning = false;
    this.sun = null;
    this.humanImpactZones = [];
    this.populationHistory = [];
    this.educationalMessages = [];

    // Prey behavior settings (default values)
    this.preyPlantRange = 30;
    this.plantSeeking = 0.015;
    this.evasionStrength = 0.05;
    this.plantRegrowthChance = 0.7;

    this.drawingActivity = false;
    this.selectedActivityType = 'pollution';

    // tracking temperatrue
    this.temperature = 20;

    this.tick = 0;  // simulation tick counter

    // Initialize the simulation (setup)
    this.setup();
  }

  /* --------------------------- */
  /* SETUP & RESET               */
  /* --------------------------- */
  setup() {
    this.resetSimulation();
    this.updatePreySettings();
    this.redrawCanvas();
    this.logInfo('Simulation setup complete.');
  }

  resetSimulation() {
    // Reset all simulation variables
    this.simulationRunning = false;
    this.entities = [];
    this.humanImpactZones = [];
    this.weather = 'sunny';
    this.raindrops = [];
    // this.humanImpact = { pollution: 0, deforestation: 0, conservation: 0 };
    this.educationalMessages = [];
    this.tick = 0;
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.updateInfo('Reset! Start a new ecosystem!');
    console.log('Simulation reset.');
  }

  /* --------------------------- */
  /* PARAMETER UPDATES           */
  /* --------------------------- */
  updatePreySettings() {
    // Get DOM values for prey-related parameters
    const preyRangeEl = document.getElementById('preyPlantRange');
    const plantSeekingEl = document.getElementById('plantSeeking');
    const evasionStrengthEl = document.getElementById('evasionStrength');
    const plantRegrowthEl = document.getElementById('plantRegrowth');

    if (preyRangeEl && plantSeekingEl && evasionStrengthEl && plantRegrowthEl) {
      this.preyPlantRange = parseInt(preyRangeEl.value);
      this.plantSeeking = parseFloat(plantSeekingEl.value);
      this.evasionStrength = parseFloat(evasionStrengthEl.value);
      this.plantRegrowthChance = parseInt(plantRegrowthEl.value) / 100;

      document.getElementById('preyPlantRangeValue').textContent = this.preyPlantRange;
      document.getElementById('plantSeekingValue').textContent = this.plantSeeking.toFixed(3);
      document.getElementById('evasionStrengthValue').textContent = this.evasionStrength.toFixed(3);
      document.getElementById('plantRegrowthValue').textContent = `${Math.round(this.plantRegrowthChance * 100)}%`;

      this.updateInfo('Prey settings updated!');
      console.log('Prey settings:', {
        preyPlantRange: this.preyPlantRange,
        plantSeeking: this.plantSeeking,
        evasionStrength: this.evasionStrength,
        plantRegrowthChance: this.plantRegrowthChance
      });
    } else {
      // Default values if UI elements are missing
      this.preyPlantRange = 30;
      this.plantSeeking = 0.015;
      this.evasionStrength = 0.05;
      this.plantRegrowthChance = 0.7;
    }
  }

  /* --------------------------- */
  /* SIMULATION SPEED CONTROL    */
  /* --------------------------- */
  updateSimulationSpeed() {
    const speedSlider = document.getElementById('simulationSpeed');
    const valueDisplay = document.getElementById('simulationSpeedValue');
  
    if (speedSlider && valueDisplay) {
      const speedValue = parseInt(speedSlider.value, 10);
      this.simulationDelay = 2000 / speedValue;
  
      // Update visible value (if not already handled in HTML inline)
      valueDisplay.textContent = speedValue;
  
      this.updateInfo(`Simulation speed set to ${speedValue}`);
    } else {
      console.warn('Speed slider or value display not found.');
    }
  }
  

  /* --------------------------- */
  /* WEATHER & UI                */
  /* --------------------------- */
  changeWeather() {
    // Update weather based on selection
    const select = document.getElementById('weather');
    if (!select) {
      console.error('Weather select not found!');
      return;
    }
    this.weather = select.value;

    this.raindrops = [];
    this.snowflakes = [];
    this.lightning = false;
    this.sun = null;

    switch (this.weather) {
      case 'rainy':
        this.raindrops = Array.from({ length: 50 }, () => ({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height
        }));
        break;
      case 'storm':
        this.raindrops = Array.from({ length: 70 }, () => ({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height
        }));
        this.lightning = true; // use in draw to flash canvas
        break;
      case 'snow':
        this.snowflakes = Array.from({ length: 40 }, () => ({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height,
          r: Math.random() * 2 + 1
        }));
        break;
      case 'sunny':
        this.sun = { x: this.canvas.width - 70, y: 70, radius: 40 };
        break;
    }

    this.updateInfo(`Weather changed to ${this.weather}!`);
    console.log('Weather:', this.weather);
    this.redrawCanvas();
  }

  updateTemperature() {
    const slider = document.getElementById("temperatureSlider");
    const temp = parseInt(slider.value, 10);
    this.temperature = temp;
    document.getElementById("temperatureValue").textContent = `${temp}°C`;
  
    this.updateInfo(`Temperature set to ${temp}°C`);
    this.redrawCanvas();
  }

  updateInfo(text) {
    // Keep educational messages unique and update the UI
    if (
      this.educationalMessages.length === 0 ||
      this.educationalMessages[this.educationalMessages.length - 1] !== text
    ) {
      this.educationalMessages.push(text);
      if (this.educationalMessages.length > 3) this.educationalMessages.shift(); 
  
      const ecoInfo = document.getElementById('eco-info');
      if (ecoInfo) {
        ecoInfo.innerHTML = '';
        this.educationalMessages.forEach(msg => {
          const p = document.createElement('p');
          p.textContent = msg;
          ecoInfo.appendChild(p);
        });
  
        // Auto-scroll to bottom
        ecoInfo.scrollTop = ecoInfo.scrollHeight;
      } else {
        console.error('eco-info element not found!');
      }
      console.log('Info:', text);
    }
  }
  

  logInfo(text) {
    console.log(text);
    this.updateInfo(text);
  }

  addEntity() {
    const select = document.getElementById('animalSelect');
    if (!select) return console.error('animalSelect not found!');
    const value = select.value;
  
    let type, emoji;
    switch (value) {
      case 'wolf':
        type = 'predator';
        emoji = '🐺';
        break;
      case 'sheep':
        type = 'prey';
        emoji = '🐑';
        break;
      case 'grass':
        type = 'plant';
        emoji = '🌿';
        break;
      default:
        return console.error('Unknown entity type:', value);
    }
  
    const numberSlider = document.getElementById('animalNumber');
    const count = numberSlider ? parseInt(numberSlider.value, 10) : 1;
  
    for (let i = 0; i < count; i++) {
      const x = Math.random() * this.canvas.width;
      const y = Math.random() * this.canvas.height;
      this.entities.push(new Entity(x, y, type, emoji));
    }
  
    const label = type === 'plant' ? 'grass patch' : value + (count > 1 ? 's' : '');
    this.updateInfo(`Added ${count} ${label}!`);
    this.redrawCanvas();
  }
  

  /* --------------------------- */
  /* RENDERING & ENVIRONMENT     */
  /* --------------------------- */
  redrawCanvas() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  
    // Set weather sky background
    if (this.weather === 'sunny') {
      ctx.fillStyle = 'rgba(135, 206, 235, 0.8)'; // sky blue
    } else if (this.weather === 'rainy' || this.weather === 'storm') {
      ctx.fillStyle = 'rgba(176, 196, 222, 0.8)'; // cloudy
    } else {
      ctx.fillStyle = 'rgba(70, 130, 180, 0.8)'; // default cloudy blue
    }
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  
    // Temperature overlay
    const temp = this.temperature;
    let tempOverlay = "";
  
    if (temp < 0) {
      tempOverlay = "rgba(200, 240, 255, 0.3)";  // Cold blue
    } else if (temp < 10) {
      tempOverlay = "rgba(180, 220, 255, 0.2)";  // Chilly
    } else if (temp < 20) {
      tempOverlay = "rgba(255, 255, 255, 0.1)";  // Neutral
    } else if (temp <= 30) {
      tempOverlay = "rgba(255, 250, 200, 0.2)";  // Warm yellow
    } else {
      tempOverlay = "rgba(255, 160, 122, 0.3)";  // Hot reddish
    }
  
    ctx.fillStyle = tempOverlay;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  
    // Sunny – draw sun
    if (this.sun) {
      ctx.beginPath();
      ctx.arc(this.sun.x, this.sun.y, this.sun.radius, 0, 2 * Math.PI);
      ctx.fillStyle = "yellow";
      ctx.fill();
    }
  
    // Rainy and Storm – raindrops
    if (this.raindrops) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      this.raindrops.forEach(drop => {
        ctx.fillRect(drop.x, drop.y, 2, 10);
        drop.y += 5;
        if (drop.y > this.canvas.height) {
          drop.y = 0;
          drop.x = Math.random() * this.canvas.width;
        }
      });
    }
  
    // Snow
    if (this.snowflakes) {
      ctx.fillStyle = "white";
      this.snowflakes.forEach(flake => {
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
        ctx.fill();
        flake.y += 1;
        flake.x += Math.sin(flake.y / 10) * 0.5;
        if (flake.y > this.canvas.height) {
          flake.y = 0;
          flake.x = Math.random() * this.canvas.width;
        }
      });
    }
  
    // Storm lightning flash
    if (this.weather === 'storm' && Math.random() < 0.03) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      setTimeout(() => this.redrawCanvas(), 50); // short flash
    }
  
    // Zones and entities
    this.humanImpactZones.forEach(zone => zone.draw(ctx));
    this.entities.forEach(entity => entity.draw(ctx));
  
    // Continue loop if running
    if (this.simulationRunning) {
      requestAnimationFrame(() => this.redrawCanvas());
    }
  }
  
  /* --------------------------- */
  /* SIMULATION LOOP (GO)        */
  /* --------------------------- */
  simulate() {
    if (!this.simulationRunning) return;
  
    // Clear and redraw background
    this.redrawCanvas();
    
    // apply temperature effects
    this.entities.forEach(entity => {
      if (this.temperature < 0) {
        entity.energy -= 0.5;
        if (entity.type === 'plant') entity.health -= 0.2;
      } else if (this.temperature > 30) {
        entity.energy -= 0.3;
        if (entity.type === 'plant' && Math.random() < 0.05) entity.health -= 1;
      }
    });
  
    // Rain grows new grass
    if (this.weather === 'rainy' && Math.random() < 0.02) {
      this.entities.push(new Entity(
        Math.random() * this.canvas.width,
        Math.random() * this.canvas.height,
        'plant',
        '🌿'
      ));
      this.updateInfo('Rain grew new plant!');
    }
  
    //  Move and render each entity
    this.entities.forEach(entity => {
      entity.move(this);
      entity.draw(this.ctx);
      // draw(this.ctx, this.humanImpact);
    });
  
    // Human impact and interactions
    // this.applyHumanActivityEffects();
    this.interactEntities();
  
    // Update stats and population graph
    const predators = this.entities.filter(e => e.type === 'predator').length;
    const prey = this.entities.filter(e => e.type === 'prey').length;
    const plants = this.entities.filter(e => e.type === 'plant' && e.health > 0).length;

    this.updateStatus(predators, prey, plants); 
  
    if (predators === 0 && prey === 0) {
      this.updateInfo('Ecosystem empty! Add more friends!');
      this.simulationRunning = false;
    } else if (prey === 0 && predators > 0) {
      this.updateInfo('No prey left! Lions might starve!');
    } else if (plants === 0 && prey > 0) {
      this.updateInfo('No grass! Prey will struggle!');
    } 
    this.populationHistory.push({ predators, prey, plants });
    this.updateGraph();
    // Schedule next frame
    setTimeout(() => this.simulate(), this.simulationDelay);
  }

  updateStatus(predators, prey, plants) {
    const status = document.getElementById("eco-status");
    if (status) {
      status.innerHTML = `Wolves: ${predators}, Sheep: ${prey}, Grass: ${plants}.`;
    }
  }
  
  

  startSimulation() {
    if (!this.simulationRunning) {
      if (this.entities.length === 0) {
        this.updateInfo('Add animals and plants first!');
        return;
      }
      this.simulationRunning = true;
      this.updateInfo('Simulation started!');
      this.simulate(); 
    }
  }
  
  
  // New stopSimulation method
  stopSimulation() {
    this.simulationRunning = false;
    this.updateInfo('Simulation stopped.');
    console.log('Simulation stopped.');
  }
  /* --------------------------- */
  /* POPULATION GRAPH            */
  /* --------------------------- */
  updateGraph() {
    if (!this.graphCtx || !this.populationHistory.length) return;
  
    const ctx = this.graphCtx;
    const width = this.graphCanvas.width;
    const height = this.graphCanvas.height;
  
    ctx.clearRect(0, 0, width, height);
  
    const history = this.populationHistory;
    const maxPop = Math.max(...history.flatMap(d => [d.predators, d.prey, d.plants]), 1);
    const xScale = (width - 40) / (history.length - 1 || 1);
    const yScale = (height - 30) / maxPop;
  
    // Axes
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(30, 10);
    ctx.lineTo(30, height - 20);
    ctx.lineTo(width - 10, height - 20);
    ctx.stroke();
  
    const drawLine = (color, key) => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      history.forEach((d, i) => {
        const x = 30 + i * xScale;
        const y = height - 20 - d[key] * yScale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
  
    drawLine('red', 'predators');
    drawLine('blue', 'prey');
    drawLine('green', 'plants');
  }

  interactEntities() {
    // Apply human impact zones effects first
    this.humanImpactZones.forEach(zone => {
      this.entities.forEach(entity => {
        zone.affectEntity(entity);
      });
    });

    // Handle entity interactions (predation and grazing)
    for (let i = 0; i < this.entities.length; i++) {
      for (let j = i + 1; j < this.entities.length; j++) {
        const e1 = this.entities[i];
        const e2 = this.entities[j];
        const distance = Math.hypot(e1.x - e2.x, e1.y - e2.y);

        // Predator eats prey
        if (e1.type === 'predator' && e2.type === 'prey' && e2.energy > 0 && distance < 50) {
          e1.energy = Math.min(100, e1.energy + 40);
          this.entities.splice(j, 1);
          this.updateInfo('A lion ate its prey! Yum!');
          j--;
        } else if (e2.type === 'predator' && e1.type === 'prey' && e1.energy > 0 && distance < 50) {
          e2.energy = Math.min(100, e2.energy + 40);
          this.entities.splice(i, 1);
          this.updateInfo('A lion ate its prey! Yum!');
          i--;
          break;
        }
        // Prey eats plant
        else if (e1.type === 'prey' && e2.type === 'plant' && distance < this.preyPlantRange && e2.health > 0) {
          e2.health -= 20;
          e1.energy = Math.min(100, e1.energy + 15);
          if (e2.health <= 0 && (this.weather === 'rainy' || Math.random() < this.plantRegrowthChance)) {
            e2.health = 20;
            this.updateInfo('Grass grew back!');
          }
          this.updateInfo('Prey ate grass!');
          if (e1.energy > 80 && Math.random() < 0.03) {
            this.entities.push(new Entity(e1.x + 20, e1.y + 20, 'prey', e1.emoji));
            this.updateInfo('A baby prey was born!');
          }
        }
      }
    }
    // Remove dead entities
    this.entities = this.entities.filter(e => e.energy > 0 || (e.type === 'plant' && e.health > 0));
    console.log('Entities after interaction:', this.entities.length);
  }
}

/**
 * Determines the weather condition based on the given temperature.
 *
 * @param {number} temp - The temperature in degrees Celsius.
 * @returns {string} The weather condition string。
 */
function getWeatherFromTemperature(temp) {
  if (temp < 0) return "snow";
  if (temp < 10) return "storm";
  if (temp < 20) return "rainy";
  if (temp <= 30) return "sunny";
  return "heatwave";
}


/* --------------------------- */
/* UI CONTROL FUNCTIONS        */
/* --------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const simulation = new Simulation();
  window.simulation = simulation

  // Expose simulation functions globally for UI controls
  window.updatePreySettings = () => simulation.updatePreySettings();
  window.addEntity = () => simulation.addEntity();
  window.changeWeather = () => simulation.changeWeather();
  window.updateTemperature  = () => simulation.updateTemperature();
  window.startSimulation = () => simulation.startSimulation();
  window.stopSimulation = () => simulation.stopSimulation();
  window.resetSimulation = () => simulation.resetSimulation();
  window.updateSimulationSpeed = () => simulation.updateSimulationSpeed(); 

  const applyTempBtn = document.getElementById("applyTemperatureBtn");
  if (applyTempBtn) {
    applyTempBtn.addEventListener("click", () => simulation.updateTemperature());
  }
  
  const canvas = document.getElementById("ecosystemCanvas");
  // window.simulation = new Simulation(canvas);

  const activitySelect = document.getElementById("activityType");
  activitySelect.addEventListener("change", (e) => {
    simulation.selectedActivityType = e.target.value;
  });

  if (canvas) {
    canvas.addEventListener("click", (e) => {
      if (!simulation.drawingActivity) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      simulation.humanImpactZones.push(new HumanImpactZone(x, y, simulation.selectedActivityType));
      simulation.updateInfo(`Placed ${simulation.selectedActivityType} zone.`);
      simulation.redrawCanvas();
    });
  }

  window.toggleActivityMode = function () {
    simulation.drawingActivity = !simulation.drawingActivity;
  
    const button = document.querySelector('button[onclick="toggleActivityMode()"]');
    if (button) {
      button.textContent = simulation.drawingActivity
        ? "Deactivate Activity Drawing"
        : "Activate Activity Drawing";
    }
  
    const mode = simulation.drawingActivity ? "enabled" : "disabled";
    simulation.updateInfo("Drawing mode " + mode + ". Click on canvas to place zone.");
  };

  window.updateActivityDescription = function () {
    const descriptions = {
      pollution: "💨 <strong>Pollution Zone:</strong> Uh oh! A smoggy cloud settles in... animals nearby lose energy fast. Not a place to hang out for too long!",
      deforestation: "🪓 <strong>Deforestation Zone:</strong> Trees fall, and grass struggles to grow. Plants caught in this area might not survive. 🌲💔",
      conservation: "🌱 <strong>Conservation Zone:</strong> Nature's safe haven! 🛡️ Animals and plants recover here, slowly regaining their strength and health. 🌿💖"
    };
  
    const select = document.getElementById("activityType");
    const descEl = document.getElementById("activityDescription");
    const selected = select.value;
  
    descEl.innerHTML = descriptions[selected] || "";
  }
  simulation.redrawCanvas();

  activitySelect.addEventListener("change", (e) => {
    simulation.selectedActivityType = e.target.value;
    updateActivityDescription(); // update the text
  });
  
  updateActivityDescription(); // call it once on load too
});