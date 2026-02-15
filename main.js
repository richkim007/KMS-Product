const generateBtn = document.getElementById('generate-btn');
const birthdateInput = document.getElementById('birthdate');
const zodiacInput = document.getElementById('zodiac');
const lottoDisplay = document.querySelector('.lotto-display');

// Pseudo-Biorhythm calculation
function getBiorhythm(birthdate) {
    const now = new Date();
    const birth = new Date(birthdate);
    const diff = now.getTime() - birth.getTime();
    const days = diff / (1000 * 60 * 60 * 24);

    const physical = Math.sin(2 * Math.PI * days / 23);
    const emotional = Math.sin(2 * Math.PI * days / 28);
    const intellectual = Math.sin(2 * Math.PI * days / 33);
    
    return { physical, emotional, intellectual };
}

// Pseudo-Zodiac influence
function getZodiacInfluence(zodiac) {
    const influences = {
        aries: 1, taurus: 5, gemini: 10, cancer: 15, leo: 20,
        virgo: 25, libra: 30, scorpio: 35, sagittarius: 40,
        capricorn: 45, aquarius: 3, pisces: 8
    };
    return influences[zodiac] || 1;
}

// "Quantum" number generation
function generateQuantumNumbers(biorhythm, zodiacInfluence) {
    const numbers = new Set();
    let seed = (biorhythm.physical + biorhythm.emotional + biorhythm.intellectual) * 100 + zodiacInfluence;

    while (numbers.size < 6) {
        // A pseudo-random algorithm using the seed
        seed = (seed * 9301 + 49297) % 233280;
        let random = seed / 233280;
        const number = Math.floor(random * 45) + 1;
        numbers.add(number);
    }
    return Array.from(numbers).sort((a, b) => a - b);
}

generateBtn.addEventListener('click', () => {
    if (!birthdateInput.value) {
        alert('생년월일을 입력해주세요.');
        return;
    }

    lottoDisplay.innerHTML = ''; // Clear previous numbers
    const biorhythm = getBiorhythm(birthdateInput.value);
    const zodiacInfluence = getZodiacInfluence(zodiacInput.value);

    for (let i = 0; i < 5; i++) {
        const lottoSet = document.createElement('div');
        lottoSet.className = 'lotto-set';

        // Slightly vary the seed for each set
        const uniqueBiorhythm = {
            physical: biorhythm.physical + (i * 0.05),
            emotional: biorhythm.emotional - (i * 0.05),
            intellectual: biorhythm.intellectual + (i * 0.03)
        };

        const numbers = generateQuantumNumbers(uniqueBiorhythm, zodiacInfluence + i);
        numbers.forEach((num, index) => {
            const numberElement = document.createElement('div');
            numberElement.className = 'number';
            numberElement.textContent = num;
            lottoSet.appendChild(numberElement);

            setTimeout(() => {
                numberElement.classList.add('animated');
            }, i * 200 + index * 100); // Stagger animation for each set
        });

        lottoDisplay.appendChild(lottoSet);
    }
});
