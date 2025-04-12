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
    if (this.type === "pollution") {
      if (entity.type === "plant") {
        entity.health -= intensity * 2;
        entity.health = Math.max(0, entity.health);
        entity.highlightColor = 'gray'; // damaged plant
      } else {
        entity.energy -= intensity * 5;
        entity.energy = Math.max(0, entity.energy);
        entity.highlightColor = 'red'; // stressed animal
      }
    
      // Reset highlight after short time
      setTimeout(() => { entity.highlightColor = null; }, 200);
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
    this.growthTimer = 0; // For plant regrowth
    // Set speed and default vision (for animals)
    if (type === 'predator') {
      this.speed = 1.5;
      this.vision = 1.0;
    } else if (type === 'prey') {
      this.speed = 1.5 + Math.random() * 0.5;
      this.vision = 1.0;
    } else {
      this.speed = 0;
    }
  }

  // Plants regrow after dying
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
    // Wander
    this.x += (Math.random() - 0.5) * this.speed;
    this.y += (Math.random() - 0.5) * this.speed;

    // Eat nearby grass if available
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
    // Find closest prey
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
      // Wander if no prey found
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

  move(sim) {
    if (this.type === 'plant') {
      this.updateGrass(sim);
    } else if (this.energy > 0) {
      if (this.type === 'prey') {
        this.preyLogic(sim);
      } else {
        this.predatorLogic(sim);
      }
    }
    // Keep entity within canvas bounds
    this.x = Math.max(0, Math.min(sim.canvas.width, this.x));
    this.y = Math.max(0, Math.min(sim.canvas.height, this.y));
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

    if (this.highlightColor) {
      ctx.strokeStyle = this.highlightColor;
      ctx.lineWidth = 3;
      ctx.stroke(); // stroke around shape
    }
  }
}

/* --------------------------- */
/* SIMULATION CLASS            */
/* --------------------------- */
class Simulation {
  constructor() {
    // Setup main simulation canvas
    this.canvas = document.getElementById('ecosystemCanvas');
    if (!this.canvas) {
      console.error('Canvas element not found!');
      return;
    }
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = 800;
    this.canvas.height = 500;

    // Setup population graph canvas (if available)
    this.graphCanvas = document.getElementById('populationGraph');
    if (this.graphCanvas) {
      this.graphCtx = this.graphCanvas.getContext('2d');
      this.graphCanvas.width = 400;
      this.graphCanvas.height = 200;
    }
    
    // Simulation settings
    this.settings = {
      sheepGainFromFood: 4,
      wolfGainFromFood: 20,
      sheepReproduceProb: 0.04,
      wolfReproduceProb: 0.05,
      grassRegrowTime: 30
    };

    // Simulation state variables
    this.entities = [];
    this.weather = 'sunny'; // only "sunny" and "rainy" are allowed
    this.simulationRunning = false;
    this.simulationDelay = 400; // update speed
    this.raindrops = [];
    this.snowflakes = [];
    this.sun = null; // used when weather is sunny
    this.humanImpactZones = [];
    this.populationHistory = [];
    this.educationalMessages = [];

    // Prey behavior settings
    this.preyPlantRange = 30;
    this.plantSeeking = 0.015;
    this.evasionStrength = 0.05;
    this.plantRegrowthChance = 0.7;

    this.drawingActivity = false;
    this.selectedActivityType = 'pollution';

    // Temperature (in °C) drives baseline effects and background color.
    this.temperature = 20;

    this.tick = 0; // simulation tick counter

    // Initialize the simulation
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
    this.simulationRunning = false;
    this.entities = [];
    this.humanImpactZones = [];
    this.weather = 'sunny';
    this.raindrops = [];
    this.snowflakes = [];
    this.educationalMessages = [];
    this.tick = 0;
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.updateInfo('Reset! Start a new ecosystem!');
    console.log('Simulation reset.');
  }

  /* --------------------------- */
  /* PARAMETER UPDATES           */
  /* --------------------------- */
  updatePreySettings() {
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
      this.preyPlantRange = 30;
      this.plantSeeking = 0.015;
      this.evasionStrength = 0.05;
      this.plantRegrowthChance = 0.7;
    }
  }

  updateSimulationSpeed() {
    const speedSlider = document.getElementById('simulationSpeed');
    const valueDisplay = document.getElementById('simulationSpeedValue');
  
    if (speedSlider && valueDisplay) {
      const speedValue = parseInt(speedSlider.value, 10);
      this.simulationDelay = 2000 / speedValue;
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
    // Weather is now set via a select control
    const select = document.getElementById('weather');
    if (!select) {
      console.error('Weather select not found!');
      return;
    }
    this.weather = select.value;
    
    // Reset visual effects
    this.raindrops = [];
    this.snowflakes = [];
    this.sun = null;

    if (this.weather === 'rainy') {
      this.raindrops = Array.from({ length: 50 }, () => ({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height
      }));
    } else if (this.weather === 'sunny') {
      this.sun = { x: this.canvas.width - 70, y: 70, radius: 40 };
    }
    
    this.updateInfo(`Weather changed to ${this.weather}!`);
    console.log('Weather:', this.weather);
    this.redrawCanvas();
  }

  /* --------------------------- */
  /* TEMPERATURE EFFECTS         */
  /* --------------------------- */
  // Returns a simple background color based on temperature using five groups.
  getTemperatureBackgroundColor(temp) {
    if (temp < 0) return "#a3d5f7";       // Freeze (cold blue)
    if (temp < 10) return "#b4dcff";      // Chilly (light blue)
    if (temp < 20) return "#e6f7ff";      // Mild (almost white-blue)
    if (temp <= 30) return "#87ceeb";     // Ideal (blue)
    return "#ff9966";                   // Hot (orange/red)
  }

  // Returns a label for the temperature effect zone.
  getTemperatureEffectZone(temp) {
    if (temp < 0) return "freeze";
    if (temp < 10) return "chilly";
    if (temp < 20) return "mild";
    if (temp <= 30) return "ideal";
    return "hot";
  }

  // Applies both temperature and weather effects to an entity.
  applyTemperatureAndWeatherEffectsToEntity(entity) {
    const zone = this.getTemperatureEffectZone(this.temperature);
    // Effects on plants
    if (entity.type === 'plant') {
      switch (zone) {
        case 'freeze': entity.health -= 0.2; break;
        case 'chilly': entity.health -= 0.1; break;
        case 'mild': entity.health += 0.05; break;
        case 'ideal': entity.health += 0.2; break;
        case 'hot': if (Math.random() < 0.05) entity.health -= 1; break;
      }
      if (this.weather === 'rainy' && (zone === 'mild' || zone === 'chilly')) {
        entity.health += 0.1; // Rain benefit for plants in cool conditions
      }
      entity.health = Math.max(0, Math.min(100, entity.health));
    }
    // Effects on animals
    if (entity.type === 'prey' || entity.type === 'predator') {
      switch (zone) {
        case 'freeze': entity.energy -= 0.5; break;
        case 'chilly': entity.energy -= 0.3; break;
        case 'mild': entity.energy -= 0.2; break;
        case 'ideal': entity.energy -= 0.1; break;
        case 'hot': entity.energy -= 0.3; break;
      }
      // Rain reduces vision slightly
      if (this.weather === 'rainy') {
        entity.vision = entity.vision ? entity.vision * 0.9 : 0.9;
      } else {
        entity.vision = 1.0;
      }
    }
  }

  updateTemperature() {
    const slider = document.getElementById("temperatureSlider");
    const temp = parseInt(slider.value, 10);
    this.temperature = temp;
    document.getElementById("temperatureValue").textContent = `${temp}°C`;
  
    this.updateInfo(`Temperature set to ${temp}°C`);
    this.redrawCanvas();
  }

  /* --------------------------- */
  /* COLOR INTERPOLATION         */
  /* --------------------------- */
  // Interpolates between two colors (provided as hex strings) using the given factor (0-1)
  interpolateColor(color1, color2, factor) {
    const c1 = parseInt(color1.slice(1), 16);
    const c2 = parseInt(color2.slice(1), 16);
    const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
    const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Gets a background color for temperature using interpolation (if desired)
  getOverlayColorFromTemp(temp) {
    // This function is kept here if you want a smooth gradient instead of fixed groups.
    if (temp <= 5) {
      const factor = (temp + 30) / 35;
      return this.interpolateColor("#0af", "#ff0", factor);
    } else {
      const factor = (temp - 5) / 35;
      return this.interpolateColor("#ff0", "#f00", factor);
    }
  }

  /* --------------------------- */
  /* RENDERING & ENVIRONMENT     */
  /* --------------------------- */
  redrawCanvas() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  
    // --- Background based solely on temperature ---
    const bgColor = this.getTemperatureBackgroundColor(this.temperature);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  
    // --- Weather Visual Effects ---
    if (this.sun) {
      ctx.beginPath();
      ctx.arc(this.sun.x, this.sun.y, this.sun.radius, 0, 2 * Math.PI);
      ctx.fillStyle = "yellow";
      ctx.fill();
    }
  
    // Display raindrops if rainy weather
    if (this.weather === 'rainy') {
      if (this.raindrops.length === 0) {
        // Initialize raindrops if not already created
        this.raindrops = Array.from({ length: 50 }, () => ({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height
        }));
      }
      this.raindrops.forEach(drop => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(drop.x, drop.y, 2, 10);
        drop.y += 5;
        if (drop.y > this.canvas.height) {
          drop.y = 0;
          drop.x = Math.random() * this.canvas.width;
        }
      });
    }
  
    // If temperature is below 0, trigger snow effect (independent of weather)
    if (this.temperature < 0) {
      if (this.snowflakes.length === 0) {
        this.snowflakes = Array.from({ length: 40 }, () => ({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height,
          r: Math.random() * 2 + 1
        }));
      }
      this.snowflakes.forEach(flake => {
        ctx.fillStyle = "white";
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
    } else {
      // Clear snowflakes if temperature is non-negative
      this.snowflakes = [];
    }
  
    // --- Draw Human Impact Zones and Entities ---
    this.humanImpactZones.forEach(zone => zone.draw(ctx));
    this.entities.forEach(entity => entity.draw(ctx));
  
    // Continue animation loop if simulation is running
    if (this.simulationRunning) {
      requestAnimationFrame(() => this.redrawCanvas());
    }
  }
  
  /* --------------------------- */
  /* SIMULATION LOOP (GO)        */
  /* --------------------------- */
  simulate() {
    if (!this.simulationRunning) return;
  
    // Redraw the environment (which includes background and effects)
    this.redrawCanvas();
    
    // Apply temperature and weather effects to all entities
    this.entities.forEach(entity => {
      this.applyTemperatureAndWeatherEffectsToEntity(entity);
    });
  
    // Rain can stimulate new plant growth
    if (this.weather === 'rainy' && Math.random() < 0.02) {
      this.entities.push(new Entity(
        Math.random() * this.canvas.width,
        Math.random() * this.canvas.height,
        'plant',
        '🌿'
      ));
      this.updateInfo('Rain grew new plant!');
    }
  
    // Move and draw each entity
    this.entities.forEach(entity => {
      entity.move(this);
      entity.draw(this.ctx);
    });
  
    // Process interactions (predation and grazing, etc.)
    this.interactEntities();
  
    // Update ecosystem stats and graph
    const predators = this.entities.filter(e => e.type === 'predator').length;
    const prey = this.entities.filter(e => e.type === 'prey').length;
    const plants = this.entities.filter(e => e.type === 'plant' && e.health > 0).length;
    this.updateStatus(predators, prey, plants);
  
    if (predators === 0 && prey === 0) {
      this.updateInfo('Ecosystem empty! Add more friends!');
      this.simulationRunning = false;
    } else if (prey === 0 && predators > 0) {
      this.updateInfo('No prey left! Predators are starving!');
    } else if (plants === 0 && prey > 0) {
      this.updateInfo('No plant! Prey will struggle!');
    }
  
    this.populationHistory.push({ predators, prey, plants });
    this.updateGraph();
  
    // Schedule next simulation frame
    setTimeout(() => this.simulate(), this.simulationDelay);
  }
  
  updateStatus(predators, prey, plants) {
    const status = document.getElementById("eco-status");
    if (status) {
      status.innerHTML = `Predators: ${predators}, Prey: ${prey}, Plant: ${plants}.`;
    }
  }
  
  interactEntities() {
    // Apply human impact effects first
    this.humanImpactZones.forEach(zone => {
      this.entities.forEach(entity => zone.affectEntity(entity));
    });
  
    // Handle interactions between entities
    for (let i = 0; i < this.entities.length; i++) {
      for (let j = i + 1; j < this.entities.length; j++) {
        const e1 = this.entities[i];
        const e2 = this.entities[j];
        const distance = Math.hypot(e1.x - e2.x, e1.y - e2.y);
  
        // Predator eats prey
        if (e1.type === 'predator' && e2.type === 'prey' && e2.energy > 0 && distance < 50) {
          e1.energy = Math.min(100, e1.energy + 40);
          this.entities.splice(j, 1);
          this.updateInfo('A wolf ate a sheep! Yum!');
          j--;
        } else if (e2.type === 'predator' && e1.type === 'prey' && e1.energy > 0 && distance < 50) {
          e2.energy = Math.min(100, e2.energy + 40);
          this.entities.splice(i, 1);
          this.updateInfo('A wolf ate a sheep! Yum!');
          i--;
          break;
        }
        // Prey eats plant
        else if (e1.type === 'prey' && e2.type === 'plant' &&
                 distance < this.preyPlantRange && e2.health > 0) {
          e2.health -= 20;
          e1.energy = Math.min(100, e1.energy + 15);
          if (e2.health <= 0 &&
             (this.weather === 'rainy' || Math.random() < this.plantRegrowthChance)) {
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
  /* UI & LOGGING FUNCTIONS      */
  /* --------------------------- */
  updateInfo(text) {
    this.educationalMessages.push(text);
    if (this.educationalMessages.length > 3) {
      this.educationalMessages.shift();
    }
    const ecoInfo = document.getElementById('eco-info');
    if (ecoInfo) {
      ecoInfo.innerHTML = '';
      this.educationalMessages.forEach(msg => {
        const p = document.createElement('p');
        p.textContent = msg;
        ecoInfo.appendChild(p);
      });
      ecoInfo.scrollTop = ecoInfo.scrollHeight;
    } else {
      console.error('eco-info element not found!');
    }
    console.log('Info:', text);
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
}


/* --------------------------- */
/* UI CONTROL FUNCTIONS        */
/* --------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const simulation = new Simulation();
  window.simulation = simulation;

  // Expose simulation functions for UI controls
  window.updatePreySettings = () => simulation.updatePreySettings();
  window.addEntity = () => simulation.addEntity();
  window.changeWeather = () => simulation.changeWeather();
  window.updateTemperature = () => simulation.updateTemperature();
  window.startSimulation = () => simulation.startSimulation();
  window.stopSimulation = () => simulation.stopSimulation();
  window.resetSimulation = () => simulation.resetSimulation();
  window.updateSimulationSpeed = () => simulation.updateSimulationSpeed();

  const applyTempBtn = document.getElementById("applyTemperatureBtn");
  if (applyTempBtn) {
    applyTempBtn.addEventListener("click", () => simulation.updateTemperature());
  }
  
  const canvas = document.getElementById("ecosystemCanvas");
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

  const activitySelect = document.getElementById("activityType");
  activitySelect.addEventListener("change", (e) => {
    simulation.selectedActivityType = e.target.value;
    updateActivityDescription();
  });

  window.toggleActivityMode = function () {
    simulation.drawingActivity = !simulation.drawingActivity;
    const button = document.querySelector('button[onclick="toggleActivityMode()"]');
    if (button) {
      button.textContent = simulation.drawingActivity
        ? "Deactivate Activity Drawing"
        : "Activate Activity Drawing";
    }
    simulation.updateInfo("Drawing mode " + (simulation.drawingActivity ? "enabled" : "disabled") + ". Click on canvas to place zone.");
  };

  window.updateActivityDescription = function () {
    const descriptions = {
      pollution: "💨 <strong>Pollution Zone:</strong> A smoggy cloud that causes nearby animals to lose energy quickly.",
      deforestation: "🪓 <strong>Deforestation Zone:</strong> Trees fall and grass struggles to grow, harming plants.",
      conservation: "🌱 <strong>Conservation Zone:</strong> A safe haven where animals and plants regain strength."
    };
    const select = document.getElementById("activityType");
    const descEl = document.getElementById("activityDescription");
    const selected = select.value;
    descEl.innerHTML = descriptions[selected] || "";
  };

  updateActivityDescription(); // Initialize activity description
  simulation.redrawCanvas();
});