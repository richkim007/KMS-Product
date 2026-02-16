document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded. main.js version 8.0 loaded.");

    const generateBtn = document.getElementById('generate-btn');
    const lottoNumbersContainer = document.getElementById('lotto-numbers-container');
    // ID 변경: birthdatetime -> birthdate
    const birthdateInput = document.getElementById('birthdate');
    const zodiacInput = document.getElementById('zodiac');

    // 생년월일 변경 시 별자리 계산
    birthdateInput.addEventListener('change', () => {
        // new Date()는 'YYYY-MM-DD' 형식을 GMT 기준으로 해석하여 하루의 오차가 발생할 수 있습니다.
        // 이를 방지하기 위해 T00:00:00을 추가하여 사용자의 시간대 기준으로 정확히 해석하도록 합니다.
        const birthdateValue = birthdateInput.value;
        if (!birthdateValue) { // 값이 없는 경우 처리
            zodiacInput.value = '';
            return;
        }
        const birthdate = new Date(birthdateValue + 'T00:00:00');
        
        if (isNaN(birthdate.getTime())) {
            zodiacInput.value = '';
            return;
        }
        const month = birthdate.getMonth() + 1;
        const day = birthdate.getDate();
        zodiacInput.value = getZodiacSign(month, day);
    });

    // 번호 생성 버튼 클릭 이벤트
    generateBtn.addEventListener('click', () => {
        const birthdate = birthdateInput.value;
        const zodiac = zodiacInput.value;

        // 알림 메시지 변경: 생년월일시 -> 생년월일
        if (!birthdate || !zodiac) {
            alert('생년월일을 선택해주세요.');
            return;
        }

        lottoNumbersContainer.innerHTML = '';
        lottoNumbersContainer.style.display = 'block';

        for (let i = 0; i < 5; i++) {
            const lottoSet = generateLottoNumbers();
            const lottoSetDiv = document.createElement('div');
            lottoSetDiv.classList.add('lotto-set');

            lottoSet.forEach(number => {
                const lottoBall = document.createElement('div');
                lottoBall.classList.add('lotto-ball');
                
                if (number <= 10) lottoBall.classList.add('c-yellow');
                else if (number <= 20) lottoBall.classList.add('c-blue');
                else if (number <= 30) lottoBall.classList.add('c-red');
                else if (number <= 40) lottoBall.classList.add('c-gray');
                else lottoBall.classList.add('c-green');

                lottoBall.textContent = number;
                lottoSetDiv.appendChild(lottoBall);
            });

            lottoNumbersContainer.appendChild(lottoSetDiv);
        }
    });

    // 로또 번호 생성 함수
    function generateLottoNumbers() {
        const numbers = new Set();
        while (numbers.size < 6) {
            const randomNumber = Math.floor(Math.random() * 45) + 1;
            numbers.add(randomNumber);
        }
        return Array.from(numbers).sort((a, b) => a - b);
    }

    // 별자리 계산 함수
    function getZodiacSign(month, day) {
        if ((month == 1 && day <= 19) || (month == 12 && day >= 22)) return "염소자리";
        if ((month == 1 && day >= 20) || (month == 2 && day <= 18)) return "물병자리";
        if ((month == 2 && day >= 19) || (month == 3 && day <= 20)) return "물고기자리";
        if ((month == 3 && day >= 21) || (month == 4 && day <= 19)) return "양자리";
        if ((month == 4 && day >= 20) || (month == 5 && day <= 20)) return "황소자리";
        if ((month == 5 && day >= 21) || (month == 6 && day <= 20)) return "쌍둥이자리";
        if ((month == 6 && day >= 21) || (month == 7 && day <= 22)) return "게자리";
        if ((month == 7 && day >= 23) || (month == 8 && day <= 22)) return "사자자리";
        if ((month == 8 && day >= 23) || (month == 9 && day <= 22)) return "처녀자리";
        if ((month == 9 && day >= 23) || (month == 10 && day <= 22)) return "천칭자리";
        if ((month == 10 && day >= 23) || (month == 11 && day <= 21)) return "전갈자리";
        if ((month == 11 && day >= 22) || (month == 12 && day <= 21)) return "사수자리";
        return "";
    }
});
