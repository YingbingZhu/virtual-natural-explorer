
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
  }

  affectEntity(entity) {
    const dist = Math.hypot(this.x - entity.x, this.y - entity.y);
    if (dist > this.radius) return;

    const intensity = 0.1;
    if (this.type === "pollution" && entity.type !== "plant") {
      entity.energy -= intensity;
    } else if (this.type === "deforestation" && entity.type === "plant") {
      if (Math.random() < 0.01) entity.health = 0;
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
    this.humanImpactZones = [];
    this.educationalMessages = [];

    // Prey behavior settings (default values)
    this.preyPlantRange = 30;
    this.plantSeeking = 0.015;
    this.evasionStrength = 0.05;
    this.plantRegrowthChance = 0.7;

    // Human activity levels (pollution, deforestation, conservation)
    this.humanImpact = {
      pollution: 0,
      deforestation: 0,
      conservation: 0
    };

    // For tracking population changes over time
    this.populationHistory = [];
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
    this.updateHumanActivity();
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
    this.humanImpact = { pollution: 0, deforestation: 0, conservation: 0 };
    this.educationalMessages = [];
    this.populationHistory = [];
    this.tick = 0;
    this.updateHumanActivity();
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

  updateHumanActivity() {
    // Read human impact from DOM and update related variables
    const impactEl = document.getElementById('humanImpact');
    if (impactEl) {
      const impactValue = parseInt(impactEl.value);
      this.humanImpact.pollution = Math.min(100, impactValue);
      this.humanImpact.deforestation = Math.min(100, impactValue);
      this.humanImpact.conservation = Math.max(0, 100 - impactValue);
      document.getElementById('humanImpactValue').textContent = `${impactValue}%`;
      this.updateInfo(`Human Impact set to ${impactValue}%!`);
      console.log('Human activity:', this.humanImpact);
    }
    this.updateHumanImpactZones();
  }

  updateHumanImpactZones() {
    // Create impact zones based on current human impact levels
    this.humanImpactZones = [];
    const totalImpact = this.humanImpact.pollution + this.humanImpact.deforestation + this.humanImpact.conservation;
    const zoneCount = Math.floor(totalImpact / 25);
    for (let i = 0; i < zoneCount; i++) {
      const x = Math.random() * this.canvas.width;
      const y = Math.random() * this.canvas.height;
      const radius = 50 + Math.random() * 30;
      let type;
      const rand = Math.random() * totalImpact;
      if (rand < this.humanImpact.pollution) type = 'pollution';
      else if (rand < this.humanImpact.pollution + this.humanImpact.deforestation) type = 'deforestation';
      else type = 'conservation';
      this.humanImpactZones.push(new HumanImpactZone(x, y, type, radius));
    }
    console.log('Human impact zones:', this.humanImpactZones.length);
  }

  /* --------------------------- */
  /* SIMULATION SPEED CONTROL    */
  /* --------------------------- */
  updateSimulationSpeed() {
    const speedSlider = document.getElementById('simulationSpeed');
    if (speedSlider) {
      // For a slider value of 1, delay = 2000ms; for 10, delay = 200ms.
      const speedValue = parseInt(speedSlider.value, 10);
      this.simulationDelay = 2000 / speedValue;
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
    if (this.weather === 'rainy') {
      this.raindrops = Array.from({ length: 50 }, () => ({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height
      }));
    } else {
      this.raindrops = [];
    }
    this.updateInfo(`Weather changed to ${this.weather}!`);
    console.log('Weather:', this.weather);
    this.redrawCanvas();
  }

  updateInfo(text) {
    // Keep educational messages unique and update the UI
    if (
      this.educationalMessages.length === 0 ||
      this.educationalMessages[this.educationalMessages.length - 1] !== text
    ) {
      this.educationalMessages.push(text);
      if (this.educationalMessages.length > 5) this.educationalMessages.shift();
      const ecoInfo = document.getElementById('eco-info');
      if (ecoInfo) {
        ecoInfo.innerHTML = this.educationalMessages.join('<br>');
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

    // Draw background with pollution overlay
    const pollutionLevel = this.humanImpact.pollution / 100;
    ctx.fillStyle = `rgba(100, 100, 100, ${pollutionLevel * 0.5})`;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Set weather background
    if (this.weather === 'sunny') {
      ctx.fillStyle = 'rgba(135, 206, 235, 0.8)';
    } else if (this.weather === 'rainy') {
      ctx.fillStyle = 'rgba(176, 196, 222, 0.8)';
    } else {
      ctx.fillStyle = 'rgba(70, 130, 180, 0.8)';
    }
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw raindrops for rainy weather
    if (this.weather === 'rainy') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      this.raindrops.forEach(drop => {
        ctx.fillRect(drop.x, drop.y, 2, 10);
        drop.y += 5;
        if (drop.y > this.canvas.height) drop.y = 0;
      });
    } else if (this.weather === 'storm' && Math.random() < 0.05) {
      ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      setTimeout(() => this.redrawCanvas(), 50);
    }

    // Render human impact zones and entities
    this.humanImpactZones.forEach(zone => zone.draw(this.ctx));
    this.entities.forEach(entity => entity.draw(this.ctx));
  }

  /* --------------------------- */
  /* SIMULATION LOOP (GO)        */
  /* --------------------------- */
  simulate() {
    if (!this.simulationRunning) return;
  
    // Step 1: Clear and redraw background
    this.redrawCanvas();
  
    // Step 2: Rain grows new grass
    if (this.weather === 'rainy' && Math.random() < 0.02) {
      this.entities.push(new Entity(
        Math.random() * this.canvas.width,
        Math.random() * this.canvas.height,
        'plant',
        '🌳'
      ));
      this.updateInfo('Rain grew new grass!');
    }
  
    // Step 3: Move and render each entity
    this.entities.forEach(entity => {
      entity.move(this);
      entity.draw(this.ctx, this.humanImpact);
    });
  
    // Step 4: Human impact and interactions
    this.applyHumanActivityEffects();
    this.interactEntities();
  
    // Step 5: Update stats and population graph
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
      status.innerHTML = `Wolves: ${predators}, Sheep: ${prey}, Grass: ${plants}. Human Impact: ${this.humanImpact?.pollution || 0}%`;
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
      this.simulate(); // 🚀 Start the loop here
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
  

  /* --------------------------- */
  /* HUMAN IMPACT & INTERACTIONS */
  /* --------------------------- */
  applyHumanActivityEffects() {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities[i];
      if (entity.type === 'prey') {
        if (Math.random() < this.humanImpact.pollution * 0.001) {
          this.updateInfo('A prey was hunted by humans!');
          this.entities.splice(i, 1);
          continue;
        }
      } else if (entity.type === 'plant') {
        if (Math.random() < this.humanImpact.deforestation * 0.001) {
          entity.health = 0;
          this.updateInfo('A plant was removed due to deforestation!');
        }
      }
    }
  }

  interactEntities() {
    // Apply human impact zones effects first
    this.humanImpactZones.forEach(zone =>
      zone.affectEntities(this.entities, this.humanImpact, (msg) => this.updateInfo(msg))
    );

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

/* --------------------------- */
/* UI CONTROL FUNCTIONS        */
/* --------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const simulation = new Simulation();

  // Expose simulation functions globally for UI controls
  window.updatePreySettings = () => simulation.updatePreySettings();
  window.updateHumanActivity = () => simulation.updateHumanActivity();
  window.addEntity = () => simulation.addEntity();
  window.changeWeather = () => simulation.changeWeather();
  window.startSimulation = () => simulation.startSimulation();
  window.stopSimulation = () => simulation.stopSimulation();
  window.resetSimulation = () => simulation.resetSimulation();
  window.updateSimulationSpeed = () => simulation.updateSimulationSpeed(); 

  simulation.redrawCanvas();
});


// Inside Simulation class, assume canvas and zone logic
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("ecosystemCanvas");
  simulation = new Simulation(canvas);

  const activitySelect = document.getElementById("activityType");
  activitySelect.addEventListener("change", (e) => {
    simulation.selectedActivityType = e.target.value;
  });

  canvas.addEventListener("click", (e) => {
    if (!simulation.drawingActivity) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    simulation.humanImpactZones.push(new HumanImpactZone(x, y, simulation.selectedActivityType));
    simulation.updateInfo(`Placed ${simulation.selectedActivityType} zone.`);
    simulation.redrawCanvas();
  });
});


let simulation;

function toggleActivityMode() {
  simulation.drawingActivity = !simulation.drawingActivity;
  const mode = simulation.drawingActivity ? "enabled" : "disabled";
  simulation.updateInfo("Drawing mode " + mode + ". Click on canvas to place zone.");
}