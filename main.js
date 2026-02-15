document.addEventListener('DOMContentLoaded', () => {
    const birthdateInput = document.getElementById('birthdate');
    const generateBtn = document.getElementById('generate-btn');
    const lottoDisplay = document.querySelector('.lotto-display');
    const zodiacInput = document.getElementById('zodiac');

    birthdateInput.addEventListener('change', () => {
        if (!birthdateInput.value) {
            zodiacInput.value = '';
            return;
        }
        const birthDate = new Date(birthdateInput.value);
        if (isNaN(birthDate.getTime())) {
            zodiacInput.value = '';
            return;
        }
        const sign = getZodiacSign(birthDate.getMonth() + 1, birthDate.getDate());
        if (sign) {
            zodiacInput.value = `${sign.sign} (${sign.start_md} ~ ${sign.end_md})`;
        } else {
            zodiacInput.value = '';
        }
    });

    generateBtn.addEventListener('click', () => {
        if (!birthdateInput.value) {
            alert('생년월일을 먼저 입력해주세요.');
            return;
        }

        const calendarType = document.querySelector('input[name="calendar"]:checked').value;
        const birthDate = new Date(birthdateInput.value);

        // 음력을 선택하면 날짜에 간단한 조정을 가하여 시드를 변경합니다.
        if (calendarType === 'lunar') {
            birthDate.setDate(birthDate.getDate() + 29); // 대략 한 달을 더해 변환을 흉내 냅니다.
        }

        const seed = birthDate.getFullYear() * 10000 + (birthDate.getMonth() + 1) * 100 + birthDate.getDate();

        lottoDisplay.innerHTML = ''; 
        for (let i = 0; i < 5; i++) {
            const lottoSet = document.createElement('div');
            lottoSet.classList.add('lotto-set');
            // 시드와 반복 인덱스를 조합하여 매번 다른 번호 조합을 생성합니다.
            const numbers = generateLottoNumbers(seed + i);
            numbers.forEach(number => {
                const ball = document.createElement('div');
                ball.classList.add('lotto-ball');
                ball.textContent = number;
                if (number <= 10) {
                    ball.classList.add('yellow');
                } else if (number <= 20) {
                    ball.classList.add('blue');
                } else if (number <= 30) {
                    ball.classList.add('red');
                } else if (number <= 40) {
                    ball.classList.add('grey');
                } else {
                    ball.classList.add('green');
                }
                lottoSet.appendChild(ball);
            });
            lottoDisplay.appendChild(lottoSet);
        }
    });

    // 날짜 기반의 시드를 받아 로또 번호를 생성하는 함수
    function generateLottoNumbers(seed) {
        const numbers = new Set();
        let currentSeed = seed;
        
        // 시드 기반의 간단한 의사 난수 생성기
        const seededRandom = () => {
            currentSeed = (currentSeed * 9301 + 49297) % 233280;
            return currentSeed / 233280;
        };

        while (numbers.size < 6) {
            numbers.add(Math.floor(seededRandom() * 45) + 1);
        }
        return Array.from(numbers).sort((a, b) => a - b);
    }

    function getZodiacSign(month, day) {
        const zodiacSigns = [
            { sign: '염소자리', start: '01-01', end: '01-19', start_md: '1/1', end_md: '1/19' },
            { sign: '물병자리', start: '01-20', end: '02-18', start_md: '1/20', end_md: '2/18' },
            { sign: '물고기자리', start: '02-19', end: '03-20', start_md: '2/19', end_md: '3/20' },
            { sign: '양자리', start: '03-21', end: '04-19', start_md: '3/21', end_md: '4/19' },
            { sign: '황소자리', start: '04-20', end: '05-20', start_md: '4/20', end_md: '5/20' },
            { sign: '쌍둥이자리', start: '05-21', end: '06-21', start_md: '5/21', end_md: '6/21' },
            { sign: '게자리', start: '06-22', end: '07-22', start_md: '6/22', end_md: '7/22' },
            { sign: '사자자리', start: '07-23', end: '08-22', start_md: '7/23', end_md: '8/22' },
            { sign: '처녀자리', start: '08-23', end: '09-23', start_md: '8/23', end_md: '9/23' },
            { sign: '천칭자리', start: '09-24', end: '10-22', start_md: '9/24', end_md: '10/22' },
            { sign: '전갈자리', start: '10-23', end: '11-22', start_md: '10/23', end_md: '11/22' },
            { sign: '사수자리', start: '11-23', end: '12-21', start_md: '11/23', end_md: '12/21' },
            { sign: '염소자리', start: '12-22', end: '12-31', start_md: '12/22', end_md: '12/31' },
        ];

        const dateStr = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        for (const sign of zodiacSigns) {
            if (dateStr >= sign.start && dateStr <= sign.end) {
                return sign;
            }
        }
        return null;
    }
});
