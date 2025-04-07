import '../css/styles.css';
import '../css/encyclopedia.css';

/**
 * Initializes the animal encyclopedia once the DOM is fully loaded.
 */
document.addEventListener("DOMContentLoaded", () => {
    const animalList = document.getElementById("animal-list");

    // Fetch animal data from regions.json
    fetch("data/animals.json")
        .then(response => response.json())
        .then(data => {
            animalList.innerHTML = ""; // Clear placeholder text

            data.regions.forEach(region => {
                // Add Iconic Animal
                addAnimalToList(region.iconic, true);

                // Add Detailed Animals
                region.detailed.forEach(animal => {
                    addAnimalToList(animal, false);
                });
            });
        })
        .catch(error => {
            console.error("Error loading animal data:", error);
            animalList.innerHTML = "<p>Error loading animal encyclopedia. Please try again later.</p>";
        });

    /**
     * Function to create and add animal cards
     * @param {Object} animal - Animal data (name, message, image, coordinates)
     * @param {boolean} isIconic - Whether the animal is iconic (larger highlight)
     */
    function addAnimalToList(animal, isIconic) {
        const animalCard = document.createElement("div");
        animalCard.classList.add("animal-card");
        if (isIconic) {
            animalCard.classList.add("iconic-animal"); // Highlight iconic animals
        }

        animalCard.innerHTML = `
            <img src="${animal.image}" alt="${animal.name}">
            <div class="animal-details">
                <h3>${animal.name}</h3>
                <p>${animal.message}</p>
                <p><strong>Location:</strong> ${getRegionDescription(animal.coordinates)}</p>
            </div>
        `;
    

        animalList.appendChild(animalCard);
    }

    /**
     * Converts coordinates into a human-friendly description
     * @param {Array} coordinates - [longitude, latitude]
     * @returns {string} - Formatted location
     */
    function getRegionDescription(coordinates) {
        const [longitude, latitude] = coordinates;

        if (longitude >= -20 && longitude <= 55 && latitude >= -35 && latitude <= 37) {
            return "🌍 Africa";
        } else if (longitude >= -130 && longitude <= -60 && latitude >= 10 && latitude <= 80) {
            return "🌎 North America";
        } else if (longitude >= -80 && longitude <= -35 && latitude >= -55 && latitude <= 15) {
            return "🌎 South America";
        } else if (longitude >= 70 && longitude <= 150 && latitude >= -50 && latitude <= 20) {
            return "🌏 Australia";
        } else if (longitude >= -30 && longitude <= 50 && latitude >= 35 && latitude <= 75) {
            return "🌍 Europe";
        } else if (longitude >= 60 && longitude <= 150 && latitude >= 5 && latitude <= 60) {
            return "🌏 Asia";
        } else {
            return "🌍 Unknown Region";
        }
    }

});
