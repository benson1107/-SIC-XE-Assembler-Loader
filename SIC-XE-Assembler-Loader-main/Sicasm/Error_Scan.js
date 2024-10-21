export function error_scan(file) {
    //console.log(file)
    //console.log(config.OPTAB)
    //  讀入資料
    let array = [];
    if (Array.isArray(file)) {
        array = file.map(line => line.trim().split(/\s+/));
    } else {
        // 如果file不是陣列，則將其轉換為一個陣列
        array = file.trim().split('\n').map(line => line.trim().split(/\s+/))
    }



    let check = true
    let CheckTab = ["ADD", "CLEAR", "COMP", "COMPR", "DIV", "J", "JEQ", "JGT",
        "JLT", "JSUB", "LDA", "LDB", "LDCH", "LDL", "LDT", "LDX",
        "MUL", "RD", "RSUB", "STA", "STB", "STCH", "STL", "STT",
        "STX", "SUB", "TD", "TIX", 'TIXR', 'WD', 'START', 'END',
        'BYTE', 'WORD', 'RESB', 'RESW', 'BASE', 'EQU', 'ADDR', 'LDS',
        "DIVR", "MULR", "SUBR"]
    let Register = ['A', 'X', 'L', 'B', 'S', 'T', 'F', 'PC', 'SW']

    //主程式開始
    let index = 0
    array.forEach((line, index) => {
        // 1. 段落數不合規定----------------------------------------------------
        if (line.length > 3 && line[0] !== '.') {
            let output = line.join(' ');
            console.log(`格式錯誤：第${index + 1}行"${output}"，\n建議修正：請檢查是否有多餘的空格\n`);
            check = false;
        }
        // 2. operand中不可有空格分割
        if (line.length !== 1 && line[0] !== '.') {
            let instruction = line[line.length - 2];
            // 判斷是否為format 4
            if (instruction.startsWith('+')) {
                instruction = instruction.substring(1);
            }
            if (!CheckTab.includes(instruction)) {
                // 檢查element是否在指令集()，若是Instruction => array[0], 若為Directive => array[1]
                if (!CheckTab.includes(instruction.toUpperCase()) &&
                    (CheckTab.includes(line[0].toUpperCase()) || CheckTab.includes(line[1].toUpperCase()))) {
                    let output = line.join(' ');
                    console.log(`格式錯誤：第${index + 1}行"${output}"，operand中不可有空格分割\n`);
                    check = false;
                }
            }
        }
    })

    // 確認沒有格式錯誤後才會判斷輸入錯誤
    if (check) {
        // 儲存所有Label方便後面做辨識
        let Label = [];
        for (let index = 0; index < array.length; index++) {
            if (array[index].length === 3 && array[index][0] !== '.') {
                Label.push(array[index][0]);
            }
        }



        for (let index = 0; index < array.length; index++) {
            let line = array[index];
            if (line.length !== 1 && line[0] !== '.') {
                // 3. 檢查指令位置是否合法
                // 4. 指令內容必須為大寫
                let instruction = line[line.length - 2];
                if (instruction.startsWith('+')) {
                    instruction = instruction.substring(1);
                }
                if (!CheckTab.includes(instruction)) {
                    if (CheckTab.includes(instruction.toUpperCase())) {
                        console.log(`輸入錯誤：第${index + 1}行"${line[line.length - 2]}"，instruction只能有大寫英文字母\n建議修正：${line[line.length - 2].toUpperCase()}\n`);
                    } else {
                        console.log(`輸入錯誤：第${index + 1}行"${line[line.length - 2]}"，輸入instruction不合法\n`);
                    }
                    check = false;
                }
                // 5.operand有寫到非數字、label、register的資料----------------------------
                // 6.label、register寫成小寫
                if (line[line.length - 1].includes("'")) {
                    let string = line[line.length - 1].split("'");
                    if (string[0] !== 'X' && string[0] !== 'C') {
                        if (string[0] === 'x' || string[0] === 'c') {
                            console.log(`輸入錯誤：第${index + 1}行"${line.join(' ')}"，${string[0]}必須為大寫英文字母\n`);
                        } else {
                            console.log(`輸入錯誤：第${index + 1}行"${line.join(' ')}"，${string[0]}必須改為"C"或"X"\n`);
                        }
                        check = false;
                    }
                }
                // #number
                else if (line[line.length - 1].startsWith('#')) {
                    let string = line[line.length - 1].substring(1);
                    if (!/^\d+$/.test(string) && !Label.includes(string) && !Register.includes(string)) {
                        console.log(`輸入錯誤：第${index + 1}行"${line.join(' ')}"，"#"後面必須連接數值、label或register\n`);
                        check = false;
                    }
                }
                // @ register
                else if (line[line.length - 1].startsWith('@')) {
                    let string = line[line.length - 1].substring(1);
                    if (!/^\d+$/.test(string) && !Label.includes(string) && !Register.includes(string)) {
                        console.log(`輸入錯誤：第${index + 1}行"${line.join(' ')}"，"@"後面必須連接數值、label或register\n`);
                        check = false;
                    }
                }
                // 不可以出現*/ (但只有*的例外，e.g.: BUFEND EQU *)
                else if ((line[line.length - 1].includes('*') || line[line.length - 1].includes('/')) && line[line.length - 1] !== '*') {
                    console.log(`輸入錯誤：第${index + 1}行"${line.join(' ')}"，不可使用"*"或"/"`);
                    check = false;
                }
                // aa+bb-cc 不會有 register
                else if (line[line.length - 1].includes('+') || line[line.length - 1].includes('-')) {
                    let result = line[line.length - 1].split('+');
                    let final_result = [];
                    // 在將帶有'-'的子字串切割，將結果存為一個array
                    result.forEach(item => {
                        final_result.push(...item.split('-'));
                    });
                    final_result.forEach(string => {
                        // 檢查是否string不是digit，也不在label中，長度>0
                        if (!string.match(/^\d+$/) && !Label.includes(string) && string.length > 0) {
                            if (!string.match(/^\d+$/) && !Label.includes(string.toUpperCase())) {
                                console.log(`輸入錯誤：第${index + 1}行"${line.join(' ')}"，不可使用未經宣告的label:${string}\n`);
                                check = false;
                            } else {
                                console.log(`警告：第${index + 1}行"${line.join(' ')}"，label "${string}" 請轉換成大寫\n建議修正：${string.toUpperCase()}\n`);
                            }
                        }
                    });
                }
                // aa,bb => label必須為大寫
                else if (line[line.length - 1].includes(',')) {
                    let string = line[line.length - 1].split(',');
                    string.forEach(name => {
                        //name不在register、label array中，也不是個數字
                        if (!Register.includes(name) && !Label.includes(name) && !name.match(/^\d+$/)) {
                            if (Register.includes(name.toUpperCase())) {
                                console.log(`輸入錯誤：第${index + 1}行"${line.join(' ')}"，register "${name}" 必須為大寫英文字母\n建議修正：${name.toUpperCase()}\n`);
                                check = false;
                            }
                            if (Label.includes(name.toUpperCase())) {
                                console.log(`輸入錯誤：第${index + 1}行"${line.join(' ')}"，Label "${name}" 必須為大寫英文字母\n建議修正：${name.toUpperCase()}\n`);
                                check = false;
                            }
                        }
                    });
                }
                // 最後一個元素必須為數值、label或register，如果不是，再則檢查其大寫形式是否為label、register，以及是否為'*'，若還是不是 => error
                else if (!/^\d+$/.test(line[line.length - 1]) && !Label.includes(line[line.length - 1]) && !Register.includes(line[line.length - 1]) && line[line.length - 1] !== '*') {
                    if (!Label.includes(line[line.length - 1].toUpperCase()) && !Register.includes(line[line.length - 1].toUpperCase())) {
                        console.log(`輸入錯誤：第${index + 1}行"${line.join(' ')}"，必須為數值、label或register\n`);
                        check = false;
                    } else {
                        console.log(`警告：第${index + 1}行"${line.join(' ')}"，請轉換成大寫\n建議修正：${line[line.length - 1].toUpperCase()}\n`);
                    }
                }

                // 7.EQU不能forward reference
                if (line[line.length - 2].toUpperCase() === 'EQU') {
                    for (let id = index; id < array.length; id++) {
                        if (line[line.length - 1] === array[id][0]) {
                            console.log(`輸入錯誤：第${index + 1}行"${line.join(' ')}"，EQU不能forward reference\n`);
                        }
                    }
                }

                // 8.START、RESW、RESB後面要是數字
                if (line[line.length - 2] === 'START' || line[line.length - 2] === 'RESW' || line[line.length - 2] === 'RESB') {
                    if (!/^\d+$/.test(line[line.length - 1])) {
                        console.log(`輸入錯誤：第${index + 1}行"${line.join(' ')}"，"${line[line.length - 2]}"後面必須連接數字\n`);
                        check = false;
                    }
                }
            }
        }

        // 9.開頭必須是START，結尾必須是END----------------------------------------------------
        //檢查開頭
        let line = array[0];
        console.log(`${line}`)
        if (line[line.length - 2] !== 'START') {
            console.log(`輸入錯誤：第1行"${line.join(' ')}"，開頭第一行必須要為"START"\n`);
            check = false;
        }
        //檢查結尾
        line = array[array.length - 1];
        if (line[line.length - 2] !== 'END') {
            console.log(`輸入錯誤：第${array.length}行"${line.join(' ')}"，結尾最後一行必須要為"END"\n`);
            check = false;
        }
    }

    return check
}