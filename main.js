document.addEventListener('DOMContentLoaded', () => {
    const birthdateInput = document.getElementById('birthdate');
    const zodiacSignDisplay = document.getElementById('zodiac-sign');
    const generateBtn = document.getElementById('generate-btn');
    const lottoDisplay = document.querySelector('.lotto-display');

    const zodiacSigns = [
        { sign: "염소자리", start: "12-22" }, { sign: "물병자리", start: "01-20" },
        { sign: "물고기자리", start: "02-19" }, { sign: "양자리", start: "03-21" },
        { sign: "황소자리", start: "04-20" }, { sign: "쌍둥이자리", start: "05-21" },
        { sign: "게자리", start: "06-22" }, { sign: "사자자리", start: "07-23" },
        { sign: "처녀자리", start: "08-23" }, { sign: "천칭자리", start: "09-24" },
        { sign: "전갈자리", start: "10-23" }, { sign: "사수자리", start: "11-23" },
        { sign: "염소자리", start: "12-22" } // Duplicate for easy lookup
    ];

    function getZodiacSign(date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const dateStr = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        for (let i = 0; i < zodiacSigns.length; i++) {
            if (dateStr >= zodiacSigns[i].start && dateStr < zodiacSigns[i+1].start) {
                return zodiacSigns[i].sign;
            }
        }
        // Handle the wrap-around case for Capricorn
        if (dateStr >= "12-22" || dateStr < "01-20") {
             return "염소자리";
        }
        return "알 수 없음"; // Should not happen
    }

    birthdateInput.addEventListener('change', () => {
        if (birthdateInput.value) {
            const birthdate = new Date(birthdateInput.value);
            const sign = getZodiacSign(birthdate);
            zodiacSignDisplay.textContent = sign;
        } else {
            zodiacSignDisplay.textContent = "생년월일을 입력하세요";
        }
    });

    function generateLottoNumbers() {
        const numbers = new Set();
        while (numbers.size < 6) {
            numbers.add(Math.floor(Math.random() * 45) + 1);
        }
        return Array.from(numbers).sort((a, b) => a - b);
    }

    function displayLottoNumbers(numbers) {
        lottoDisplay.innerHTML = ''; // Clear previous numbers
        const setDiv = document.createElement('div');
        setDiv.className = 'lotto-set';

        numbers.forEach(number => {
            const ball = document.createElement('div');
            ball.className = 'lotto-ball';
            ball.textContent = number;
            
            // Assign colors based on number ranges
            if (number <= 10) ball.style.backgroundColor = '#f39c12'; // Yellow
            else if (number <= 20) ball.style.backgroundColor = '#3498db'; // Blue
            else if (number <= 30) ball.style.backgroundColor = '#e74c3c'; // Red
            else if (number <= 40) ball.style.backgroundColor = '#95a5a6'; // Grey
            else ball.style.backgroundColor = '#2ecc71'; // Green
            
            setDiv.appendChild(ball);
        });

        lottoDisplay.appendChild(setDiv);
    }

    generateBtn.addEventListener('click', () => {
        const birthdate = birthdateInput.value;
        const birthtime = document.getElementById('birthtime').value;

        if (!birthdate || !birthtime) {
            alert("생년월일과 태어난 시간을 모두 입력해주세요.");
            return;
        }

        // The core logic for number generation can be more complex,
        // incorporating birthdate, time, and zodiac, but for now, it's random.
        const lottoNumbers = generateLottoNumbers();
        displayLottoNumbers(lottoNumbers);
    });
});
