import '../css/styles.css';
import '../css/ecosystem.css';

/**
 * Represents a human impact zone in the simulation.
 * The zone will affect entities.
 * 
 * @class HumanImpactZone
 */
class HumanImpactZone {
  
  /**
   * Creates a new impact zone.
   * 
   * @param {number} x - x coordinate of the zone center.
   * @param {number} y - y coordinate of the zone center.
   * @param {'pollution' | 'deforestation' | 'conservation'} type - human activity type
   * @param {number} [radius=60] - radius of zone
   */
  constructor(x, y, type, radius = 60) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = radius;
  }

  /**
   * Draws the impact zone on canvas.
   * 
   * @param {*} ctx  canvas context.
   */
  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
    ctx.fillStyle = {
      pollution: "rgba(128,128,128,0.3)",
      deforestation: "rgba(160,82,45,0.3)",
      conservation: "rgba(0,255,0,0.3)"
    }[this.type];
    ctx.fill();

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

  /**
   * Applies effect to entities.
   * 
   * @param {Object} entity the entity.
   * @returns 
   */
  affectEntity(entity) {
    const dist = Math.hypot(this.x - entity.x, this.y - entity.y);
    if (dist > this.radius) return;

    const now = Date.now();
    // intensity ratio set to 1 to make effects more visible
    const intensity = 1;

    if (!entity.activeEffects) entity.activeEffects = new Set();

    let affected = false;

    switch (this.type) {
      case "pollution":
        affected = this.applyPollution(entity, intensity);
        break;
      case "deforestation":
        affected = this.applyDeforestation(entity, intensity);
        break;
      case "conservation":
        affected = this.applyConservation(entity, intensity);
        break;
    }
  
    if (affected) {
      entity.highlightUntil = Date.now() + 200;
      this.setHighlightColor(entity);
    }
  }

  /**
   * Affects both animals and plants.
   * Based on findings from Usman et al. (2023), animals are more sensitive to pollution
   * 
   * @param {*} entity the affected entity
   * @param {*} intensity the intensity set in class
   */
  applyPollution(entity, intensity) {
    entity.activeEffects.add("pollution");
    if (entity.type === "plant") {
      entity.health = Math.max(0, entity.health - intensity * 2);
    } else {
      entity.energy = Math.max(0, entity.energy - intensity * 5);
    }
    return true;
  }

  /**
   * Only directly affects plants
   * 
   * @param {*} entity the affected entity
   * @param {*} intensity the intensity set in class
   */
  applyDeforestation(entity, intensity) {
    if (entity.type !== 'plant') return false;
    entity.activeEffects.add("deforestation");
    entity.health = Math.max(0, entity.health - intensity * 5);
    return true;
  }

  /**
   * Affects both plants and animals, use research result from Langhammer et al. (2024) 
   * Animal recovery is quicker.
   * 
   * @param {*} entity the affected entity
   * @param {*} intensity the intensity set in class
   */
  applyConservation(entity, intensity) {
    entity.activeEffects.add("conservation");
    if (entity.type === "plant") {
      entity.health = Math.min(50, entity.health + intensity);
    } else {
      entity.energy = Math.min(50, entity.energy + intensity * 1.24);
    }
    return true;
  }

  /**
   * Sets the highlight color for the affected entity
   *
   * @param {Object} entity - the affected entity
   */
  setHighlightColor(entity) {
    const effects = entity.activeEffects;
    if (effects.has("conservation") && (effects.has("pollution") || effects.has("deforestation"))) {
      entity.highlightColor = "yellow";
    } else if (effects.has("pollution") || effects.has("deforestation")) {
      entity.highlightColor = "red";
    } else if (effects.has("conservation")) {
      entity.highlightColor = "lightgreen";
    }
  }
}

export default HumanImpactZone;


/**
 * Represents an Entity in the simulation.
 * 
 * @class Entity
 */
class Entity {
  /**
   * Creates an entity.
   * 
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   * @param {string} type - The entity type
   * @param {string} emoji - The entity emoji 
   * @param {Simulation} sim - The simulation instance 
   */
  constructor(x, y, type, emoji, sim) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.emoji = emoji;
    this.sim = sim;
    this.energy = type !== 'plant' ? sim.settings.animalInitialEnergy : 0;
    this.health = type === 'plant' ? sim.settings.plantInitialHealth : 0;
    // plant regrowth rate
    this.growthTimer = 0; 
    // animal reproduction cooldown
    this.reproduceCooldown = 0;
    // Set speed for animals
    if (type === 'predator') {
      this.speed = sim.settings.wolfBaseSpeed + Math.random() * sim.settings.wolfSpeedVariance;
    } else if (type === 'prey') { 
      this.speed = sim.settings.sheepBaseSpeed + Math.random() * sim.settings.sheepSpeedVariance;
    } else { // plant is fixed
      this.speed = 0;
    }
    // active effects from human impact zones
    this.activeEffects = new Set();
    this.highlightColor = null;
    this.highlightUntil = 0;
  }

  /**
   * Handles the plant logic.
   */
  updateGrass() {
    if (this.health <= 0) {
      this.growthTimer++;
      if (this.growthTimer > this.sim.settings.grassRegrowTime) {
        this.health = this.sim.settings.plantInitialHealth;
        this.growthTimer = 0;
      }
    }
  }

  /**
   * Handles the prey logic. Prey will move towards grass and run from predator
   */
  preyLogic() {
    let nearestGrass = null;
    let minDistGrass = Infinity;

    // Use the search range for detecting grass.
    const searchRange = this.sim.settings.sheepSearchRange;

    // Find nearest grass within the search range.
    this.sim.entities.forEach(e => {
      if (e.type === 'plant' && e.health > 0) {
        const d = Math.hypot(this.x - e.x, this.y - e.y);
        if (d < searchRange && d < minDistGrass) {
          minDistGrass = d;
          nearestGrass = e;
        }
      }
    });

    // Find nearest predator.
    let nearestPredator = null;
    let predatorDist = Infinity;
    this.sim.entities.forEach(e => {
      if (e.type === 'predator') {
        const d = Math.hypot(this.x - e.x, this.y - e.y);
        if (d < predatorDist) {
          predatorDist = d;
          nearestPredator = e;
        }
      }
    });

    // If a predator is detected within fear range, flee.
    const fearRange = this.sim.settings.sheepFearRange || 100;
    if (nearestPredator && predatorDist < fearRange) {
      const dx = this.x - nearestPredator.x;
      const dy = this.y - nearestPredator.y;
      const dist = Math.hypot(dx, dy) || 1;
      const fleeSpeedMultiplier = 1.2;
      this.x += (dx / dist) * this.speed * fleeSpeedMultiplier;
      this.y += (dy / dist) * this.speed * fleeSpeedMultiplier;
    }
    // Otherwise, if grass is found, move toward it.
    else if (nearestGrass) {
      const dx = nearestGrass.x - this.x;
      const dy = nearestGrass.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }
    // If neither is found, wander randomly.
    else {
      this.x += (Math.random() - 0.5) * this.speed;
      this.y += (Math.random() - 0.5) * this.speed;
    }

    // If close enough to the grass to eat it.
    if (nearestGrass && minDistGrass < this.sim.settings.sheepEatRange) {
      const grazeAmount = this.sim.settings.sheepGrazeAmount;
      const energyGain = this.sim.settings.sheepGainFromFood;
      nearestGrass.health = Math.max(0, nearestGrass.health - grazeAmount);
      this.energy = Math.min(this.sim.settings.animalInitialEnergy, this.energy + energyGain);
      if (nearestGrass.health === 0) {
        this.sim.updateInfo("Sheep ate a grass patch!");
      }
    }

    // Deduct energy for moving.
    this.energy -= 0.5;

    // Reproduce if energy is sufficient.
    if (this.energy > this.sim.settings.sheepReproduceThreshold &&
        Math.random() < this.sim.settings.sheepReproduceProb) {
      this.sim.entities.push(new Entity(this.x + 10, this.y + 10, 'prey', this.emoji, this.sim));
      this.energy /= 2;
      this.sim.updateInfo("A sheep was born!");
    }
  }

  /**
   * Handles predator logics
   */
  predatorLogic() {
    let target = null;
    let minDist = Infinity;
    const searchRange = this.sim.settings.wolfSearchRange; 

    // Find the closest prey within the search range
    this.sim.entities.forEach(e => {
      if (e.type === 'prey') {
        const d = Math.hypot(this.x - e.x, this.y - e.y);
        if (d < searchRange && d < minDist) {
          minDist = d;
          target = e;
        }
      }
    });

    if (target) {
      // Calculate vector towards the target prey
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      // Move the predator towards the prey
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
      
      // If the prey is close enough, attack it
      if (minDist < this.sim.settings.wolfAttackRange) {
        // Remove the target from the simulation
        this.sim.entities = this.sim.entities.filter(e => e !== target);
        this.energy = Math.min(this.sim.settings.animalInitialEnergy, this.energy + this.sim.settings.wolfGainFromFood);
        this.sim.updateInfo("A wolf ate a sheep!");
      }
    } else {
      // If no prey is found within the search range, wander randomly.
      this.x += (Math.random() - 0.5) * this.speed;
      this.y += (Math.random() - 0.5) * this.speed;
    }
    
    // Deduct energy for movement
    this.energy -= 0.5;
    
    // Reproduce if enough energy and probability check passes.
    if (this.energy > this.sim.settings.wolfReproduceThreshold && Math.random() < this.sim.settings.wolfReproduceProb) {
      this.sim.entities.push(new Entity(this.x + 10, this.y + 10, 'predator', this.emoji, this.sim));
      this.energy /= 2;
      this.sim.updateInfo("A wolf was born!");
    }
  }


  /**
   * Entity move
   */
  move() {
    if (this.type === 'plant') {
      this.updateGrass();
    } else if (this.energy > 0) {
      if (this.type === 'prey') {
        this.preyLogic();
      } else {
        this.predatorLogic();
      }
    }
    // Keep entity within canvas bounds
    this.x = Math.max(0, Math.min(this.sim.canvas.width, this.x));
    this.y = Math.max(0, Math.min(this.sim.canvas.height, this.y));
  }

  /**
   * Draw on canvas
   * 
   * @param {*} ctx  canvas context.
   */
  draw(ctx) {
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.emoji, this.x, this.y);
  
    // Draw health or energy bar under the emoji
    const barWidth = 25;
    const barHeight = 5;
    const barX = this.x - barWidth / 2;
    const barY = this.y + 20;
  
    if (this.type === 'plant') {
      const healthWidth = (this.health / this.sim.settings.plantInitialHealth) * barWidth;
      ctx.fillStyle = this.health > this.sim.settings.plantInitialHealth / 2 ? 'green' : 'red';
      ctx.fillRect(barX, barY, healthWidth, barHeight);
    } else {
      const energyWidth = (this.energy / this.sim.settings.plantInitialHealth) * barWidth;
      ctx.fillStyle = this.energy > this.sim.settings.animalInitialEnergy / 2 ? 'green' : 'red';
      ctx.fillRect(barX, barY, energyWidth, barHeight);
    }
  
    // Draw highlight if affected by human activity
    if (this.highlightColor) {
      ctx.beginPath();
      ctx.strokeStyle = this.highlightColor;
      ctx.lineWidth = 3;
      ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
  }  
}

/**
 * Main class responsible for managing the ecosystem simulation.
 * 
 * @class Simulation
 */
class Simulation {
  constructor() {
    // Setup main simulation canvas
    this.canvas = document.getElementById('ecosystemCanvas');
    if (!this.canvas) {
      console.error('Canvas element not found!');
      return;
    }
    this.ctx = this.canvas.getContext('2d');
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.ctx = this.canvas.getContext("2d");
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Setup population graph canvas
    this.graphCanvas = document.getElementById('populationGraph');
    if (this.graphCanvas) {
      this.graphCtx = this.graphCanvas.getContext('2d');
      this.graphCanvas.width = 300;
      this.graphCanvas.height = 150;
    }
    
    // Simulation settings
    this.settings = {
      animalInitialEnergy: 50,
      // sheep related 
      sheepSearchRange: 150, 
      sheepEatRange: 30,
      sheepGrazeAmount: 5,
      sheepGainFromFood: 20,
      sheepReproduceProb: 0.03,
      sheepReproduceThreshold: 30,
      sheepBaseSpeed: 2,
      sheepSpeedVariance: 0.5,
      sheepFearRange: 50,
      // wolf
      wolfGainFromFood: 20,
      wolfReproduceProb: 0.03,
      wolfReproduceThreshold: 40,
      wolfSpeedVariance: 0.5,
      wolfSearchRange: 300,
      wolfAttackRange: 30,
      wolfBaseSpeed: 3,
      // grass
      grassRegrowTime: 30,
      plantInitialHealth: 50,
    };

    // Simulation state variables
    this.entities = [];
    // default states
    this.weather = 'sunny'; 
    this.simulationRunning = false;
    this.simulationDelay = 400; 
    this.raindrops = [];
    this.snowflakes = [];
    this.humanImpactZones = [];
    this.drawingActivity = false;
    this.selectedActivityType = 'pollution';
    this.populationHistory = [];
    this.educationalMessages = [];
    this.temperature = 20;
    this.tick = 0; 

    // Initialize the simulation
    this.setup();
  }

  /**
   * Gets the currect simulation settings.
   * s
   * @returns simualtion context string
   */
/**
 * Gets the current simulation settings and behavior rules.
 * @returns {string} Simulation context string.
 */
getSimulationContext() {
  return `
  Simulation behavior rules:
  - Animal initial energy: ${this.settings.animalInitialEnergy}.
  
  - Sheep:
      * Detection & Grazing:
          - Eat range: ${this.settings.sheepEatRange} units.
          - Graze amount: ${this.settings.sheepGrazeAmount} (reduces plant health per bite).
          - Energy gain from grazing: ${this.settings.sheepGainFromFood}.
      * Movement:
          - Base speed: ${this.settings.sheepBaseSpeed}.
          - Speed variance: ${this.settings.sheepSpeedVariance}.
          - Fear range (to detect predators): ${this.settings.sheepFearRange} units.
      * Reproduction:
          - Reproduction threshold: ${this.settings.sheepReproduceThreshold} energy.
          - Reproduction probability: ${(this.settings.sheepReproduceProb * 100).toFixed(1)}%.
  
  - Wolves:
      * Attack:
          - Attack range: ${this.settings.wolfAttackRange} units.
          - Energy gain from eating sheep: ${this.settings.wolfGainFromFood}.
      * Movement:
          - Base speed: ${this.settings.wolfBaseSpeed}.
          - Speed variance: ${this.settings.wolfSpeedVariance}.
      * Reproduction:
          - Reproduction threshold: ${this.settings.wolfReproduceThreshold} energy.
          - Reproduction probability: ${(this.settings.wolfReproduceProb * 100).toFixed(1)}%.
  
  - Grass:
      * Regrowth time: ${this.settings.grassRegrowTime} ticks.
      * Initial plant health: ${this.settings.plantInitialHealth}.
      
  - Temperature and Weather Effects:
      * Temperature zones:
          - "Freeze" (< 0°C): Plants lose 0.2 health per tick; Animals lose 0.5 energy per tick.
          - "Chilly" (0°C to <15°C): Plants lose 0.1 health per tick.
          - "Ideal" (15°C to <30°C): Plants gain 0.2 health per tick; Animals are unaffected.
          - "Hot" (>= 30°C): Plants lose 1 health per tick; Animals lose 0.3 energy per tick.
      * Weather:
          - Rainy conditions give plants an extra 0.1 health per tick.

  - Environmental Effects:
      * Pollution lowers plant health by 1.5× intensity and animal energy by 5× intensity.
      * Deforestation lowers plant health by 3× intensity.
      * Conservation slowly heals plants and animals.
  `.trim();
}

  /**
   * set up the simulation
   */
  setup() {
    this.resetSimulation();
    this.redrawCanvas();
    this.logInfo('Simulation setup complete.');
  }

  /**
   * reset simulation
   */
  resetSimulation() {
    this.simulationRunning = false;
    this.entities = [];
    this.humanImpactZones = [];
    this.weather = 'sunny';
    this.raindrops = [];
    this.snowflakes = [];
    this.educationalMessages = [];
    this.tick = 0;
    this.populationHistory = [];
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.temperature = 20;
      const bgColor = this.getTemperatureBackgroundColor(this.temperature);
      this.ctx.fillStyle = bgColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (this.graphCtx) this.graphCtx.clearRect(0, 0, this.graphCanvas.width, this.graphCanvas.height);
    this.updateInfo('Reset! Start a new ecosystem!');
  }

  /**
   * update simulation speed
   */
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
  
  /**
   * handles weather change
   */
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

    if (this.weather === 'rainy') {
      this.raindrops = Array.from({ length: 50 }, () => ({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height
      }));
    } 
    
    this.updateInfo(`Weather changed to ${this.weather}!`);
    this.redrawCanvas();
  }

  /**
   * Returns the background color give temperature.
   * 
   * @param {number} temp temperature
   * @returns the color code
   */
  getTemperatureBackgroundColor(temp) {
    if (temp < 0) return "#a3d5f7";        // cold blue
    if (temp < 15) return "#b4dcff";      // light blue
    if (temp < 30) return "#87ceeb";     // blue
    return "#ff9966";                   // orange/red
  }

  /**
   * Returns the temperature group.
   * 
   * @param {number} temp temperature
   * @returns temperature group
   */
  getTemperatureEffectZone(temp) {
    if (temp < 0) return "freeze";
    if (temp < 15) return "chilly";
    if (temp < 30) return "ideal";
    return "hot";
  }

  /**
   * Applies both temperature and weather effects to an entity.
   * 
   * @param {*} entity the Entity
   */
  applyTemperatureAndWeatherEffectsToEntity(entity) {
    const zone = this.getTemperatureEffectZone(this.temperature);
    // Effects on plants
    if (entity.type === 'plant') {
      switch (zone) {
        case 'freeze': entity.health -= 0.2; break;
        case 'chilly': entity.health -= 0.1; break;
        case 'ideal': entity.health += 0.2; break;
        case 'hot': entity.health -= 1; break;
      }
      if (this.weather === 'rainy') {
        entity.health += 0.1; // Rain benefit for plants 
      }
      entity.health = Math.max(0, Math.min(this.settings.plantInitialHealth, entity.health));
    }
    // Effects on animals
    if (entity.type === 'prey' || entity.type === 'predator') {
      switch (zone) {
        case 'freeze': entity.energy -= 0.5; break;
        case 'hot': entity.energy -= 0.3; break;
        default: break;
      }
    }
  }

  /**
   * update temperatrue based on user setting
   */
  updateTemperature() {
    const slider = document.getElementById("temperatureSlider");
    const temp = parseInt(slider.value, 10);
    this.temperature = temp;
    document.getElementById("temperatureValue").textContent = `${temp}°C`;
  
    this.updateInfo(`Temperature set to ${temp}°C`);
    this.redrawCanvas();
  }

  /**
   * redraw canvas
   */
  redrawCanvas() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
    // background color based on temprature
    const bgColor = this.getTemperatureBackgroundColor(this.temperature);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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
  
    // If temperature is below 0, trigger snow effect
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
  
    // Draw Human Impact Zones and Entities
    this.humanImpactZones.forEach(zone => zone.draw(ctx));
    this.entities.forEach(entity => entity.draw(ctx));
  
    // Continue animation loop if simulation is running
    if (this.simulationRunning) {
      requestAnimationFrame(() => this.redrawCanvas());
    }
    ctx.restore();
  }
  
  /**
   * simulation loop
   */
  simulate() {
    if (!this.simulationRunning) return;
    this.redrawCanvas();
    
    // Apply temperature and weather effects to all entities
    this.entities.forEach(entity => {
      this.applyTemperatureAndWeatherEffectsToEntity(entity);
    });
  
    // Apply rain effect: boost grass growth
    if (this.weather === 'rainy' && Math.random() < 0.02) {
      this.entities.push(new Entity(
        Math.random() * this.canvas.width,
        Math.random() * this.canvas.height,
        'plant',
        '🌿',
        this
      ));
      this.updateInfo('Rain grew new plant!');
    }
    // move all entities
    this.entities.forEach(entity => {
      entity.move();
    });

    // Apply human impact + animal interactions
    this.humanImpactZones.forEach(zone => {
      this.entities.forEach(entity => zone.affectEntity(entity));
    });

    // Draw updated entities
    this.entities.forEach(entity => {
      entity.draw(this.ctx);
    });

    // Remove dead entities
    this.entities = this.entities.filter(e => e.energy > 0 || (e.type === 'plant' && e.health > 0));
  
    // Update ecosystem stats and graph
    const predators = this.entities.filter(e => e.type === 'predator').length;
    const prey = this.entities.filter(e => e.type === 'prey').length;
    const plants = this.entities.filter(e => e.type === 'plant' && e.health > 0).length;
    this.updateStatus(predators, prey, plants, this.temperature);
  
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
  
  /**
   * Updates the status info.
   * 
   * @param {*} predators number of predators
   * @param {*} prey number of preys
   * @param {*} plants number of plants
   * @param {*} temperature temperatrue
   */
  updateStatus(predators, prey, plants, temperature) {
    const status = document.getElementById("eco-status");
    if (status) {
      status.innerHTML = `Predators: ${predators}, Prey: ${prey}, Plant: ${plants}, temperature: ${temperature}°`;
    }
  }
  
  /**
   * Starts the simulation
   */
  startSimulation() {
    if (!this.simulationRunning) {
      if (this.entities.length === 0) {
        this.logInfo('Add animals and plants first!');
        return;
      }
      this.simulationRunning = true;
      this.logInfo('Simulation started!');
      this.simulate(); 
    }
  }

  /**
   * Stops the simulation
   */
  stopSimulation() {
    this.simulationRunning = false;
    this.logInfo('Simulation stopped.');
  }
  
  /**
   * Updates the population graph.
   */
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
  
/**
 * Updates the canvas information panel.
 * 
 * @param {string} text - the message
 */
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
  }
  
  /**
   * logs the message and update info panel.
   * 
   * @param {string} text - The message to log.
   */
  logInfo(text) {
    console.log(text);
    this.updateInfo(text);
  }
  
  /**
   * Add entities on canvas
   */
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
      this.entities.push(new Entity(x, y, type, emoji, this));
    }
  
    const label = type === 'plant' ? 'grass patch' : value + (count > 1 ? 's' : '');
    this.updateInfo(`Added ${count} ${label}!`);
    this.redrawCanvas();
  }
}

/**
 * Initializes UI control functions and event listeners after the DOM is fully loaded.
 */
document.addEventListener("DOMContentLoaded", () => {
  const simulation = new Simulation();
  window.simulation = simulation;

  // Expose simulation functions for UI controls
  // window.updatePreySettings = () => simulation.updatePreySettings();
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
      pollution: "💨 <strong>Pollution Zone:</strong> This area is overwhelmed by smog and toxic emissions. Both Animal friends and plants are affected, expecially animals.",
      deforestation: "🪓 <strong>Deforestation Zone:</strong> In this zone, excessive tree cutting diminish plant regrowth. It will reduces food for our herbivores friends",
      conservation: "🌱 <strong>Conservation Zone:</strong> This is a protected area where recovery efforts help animals regain energy and plants slowly restore their health. "
    };
    const select = document.getElementById("activityType");
    const descEl = document.getElementById("activityDescription");
    const selected = select.value;
    descEl.innerHTML = descriptions[selected] || "";
  };

  updateActivityDescription(); // Initialize activity description
  simulation.redrawCanvas();
});

/**
 * toggle the chat box
 */
function toggleChat() {
  const chatBox = document.getElementById("chat-box");
  chatBox.classList.toggle("hidden");
}

/**
 * Handles the keypress event on the chat input field.
 */
document.getElementById("chat-input").addEventListener("keypress", async (e) => {
  if (e.key !== "Enter") return;

  const input = e.target.value.trim();
  if (!input) return;

  const chatBody = document.getElementById("chat-body");
  chatBody.innerHTML += `<div class="msg user">${input}</div>`;
  e.target.value = "";

  const botMsg = document.createElement("div");
  botMsg.className = "msg bot";
  botMsg.textContent = "Thinking...";
  chatBody.appendChild(botMsg);
  chatBody.scrollTop = chatBody.scrollHeight;

  try {
    const systemPrompt = `
      You are a teacher helping users understand how the virtual ecosystem simulation works.
      ONLY answer questions related to:
      - Simulation controls (temperature, weather, simulation speed, etc.)
      - Ecosystem entities (wolves, sheep, grass)
      - Human impact zones (pollution, deforestation, conservation)

      Do NOT answer anything not directly related to the ecosystem simulation.
      Keep answers clear, short, and age-appropriate.
      Do NOT mention that you are an AI.
      Help user understand better.

      ${window.simulation?.getSimulationContext() || ""}
      `.trim();
    
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4",
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input }
        ]
      })
    });
    console.log(res);

    const data = await res.json();
    botMsg.textContent = data.choices?.[0]?.message?.content || "Sorry, I didn’t get that!";
    chatBody.scrollTop = chatBody.scrollHeight;
  } catch (err) {
    botMsg.textContent = "Oops! Something went wrong.";
  }
});

window.toggleChat = toggleChat;