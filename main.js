console.log("main.js version 3.0 loaded."); // 이 메시지가 보이면 새 코드가 적용된 것입니다.

const generateBtn = document.getElementById('generate-btn');
const lottoNumbersContainer = document.getElementById('lotto-numbers-container');
const birthdatetimeInput = document.getElementById('birthdatetime');
const birthdateGroup = document.getElementById('birthdate-group');
const zodiacInput = document.getElementById('zodiac');

// --- 최종 날짜 선택 기능 --- 
// 생년월일 그룹 전체에 클릭 이벤트를 설정합니다.
// 라벨, 입력창, 주변 빈 공간 어디를 클릭해도 작동합니다.
birthdateGroup.addEventListener('click', () => {
    // 모바일 및 최신 브라우저에서는 달력을 바로 표시합니다.
    try {
        birthdatetimeInput.showPicker();
    } catch (error) {
        // showPicker가 지원되지 않는 경우, 입력창에 포커스를 맞춰
        // 브라우저 기본 동작으로 달력이 열리도록 유도합니다.
        birthdatetimeInput.focus();
        console.error("showPicker() is not supported in this browser:", error);
    }
});

birthdatetimeInput.addEventListener('change', () => {
    const birthdatetime = new Date(birthdatetimeInput.value);
    if (isNaN(birthdatetime.getTime())) { // 유효하지 않은 날짜 확인
        zodiacInput.value = '';
        return;
    }
    const month = birthdatetime.getMonth() + 1;
    const day = birthdatetime.getDate();
    zodiacInput.value = getZodiacSign(month, day);
});

generateBtn.addEventListener('click', () => {
    const birthdatetime = birthdatetimeInput.value;
    const zodiac = zodiacInput.value;

    if (!birthdatetime || !zodiac) {
        alert('생년월일시를 선택해주세요.');
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

function generateLottoNumbers() {
    const numbers = new Set();
    while (numbers.size < 6) {
        const randomNumber = Math.floor(Math.random() * 45) + 1;
        numbers.add(randomNumber);
    }
    return Array.from(numbers).sort((a, b) => a - b);
}

function getZodiacSign(month, day) {
    if ((month == 1 && day <= 19) || (month == 12 && day >= 22)) {
        return "염소자리";
    } else if ((month == 1 && day >= 20) || (month == 2 && day <= 18)) {
        return "물병자리";
    } else if ((month == 2 && day >= 19) || (month == 3 && day <= 20)) {
        return "물고기자리";
    } else if ((month == 3 && day >= 21) || (month == 4 && day <= 19)) {
        return "양자리";
    } else if ((month == 4 && day >= 20) || (month == 5 && day <= 20)) {
        return "황소자리";
    } else if ((month == 5 && day >= 21) || (month == 6 && day <= 20)) {
        return "쌍둥이자리";
    } else if ((month == 6 && day >= 21) || (month == 7 && day <= 22)) {
        return "게자리";
    } else if ((month == 7 && day >= 23) || (month == 8 && day <= 22)) {
        return "사자자리";
    } else if ((month == 8 && day >= 23) || (month == 9 && day <= 22)) {
        return "처녀자리";
    } else if ((month == 9 && day >= 23) || (month == 10 && day <= 22)) {
        return "천칭자리";
    } else if ((month == 10 && day >= 23) || (month == 11 && day <= 21)) {
        return "전갈자리";
    } else if ((month == 11 && day >= 22) || (month == 12 && day <= 21)) {
        return "사수자리";
    } else {
        return "";
    }
}
