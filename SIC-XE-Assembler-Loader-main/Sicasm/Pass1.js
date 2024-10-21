import config from "./config.json" with {type: 'json'};

export function pass1(fileContent) {
    let LOC = 0;
    let SYMTAB = {};
    let Interfile = [];
    let ProgramName;

    const lines = fileContent.split('\n');
    
    lines.forEach((line) => {
        let temp = line.split(/\s+/).filter(word => word !== '');
        
        if (temp.length === 0) return;

        let place1 = temp[0];
        line = line.trim();             //去除句尾的\n
        
        //判斷切割後的輸入長度
        if (temp.length === 3) {
            if (temp[1] === 'START') {
                LOC = parseInt(temp[2], 10);
                SYMTAB[temp[0]] = LOC.toString(16).toUpperCase().padStart(4, '0');                //將LOC轉成hex四碼靠右對齊的字串，將檔名寫入SYMTAB
                ProgramName = temp[0];
                Interfile.push(`${LOC.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
            } else {
                if (temp[0] !== '.') {
                    if (Array.isArray(config.Assembler_directives) && !config.Assembler_directives.includes(temp[1]) && !(temp[0] in SYMTAB)) {
                        SYMTAB[temp[0]] = LOC.toString(16).toUpperCase().padStart(4, '0');
                        Interfile.push(`${LOC.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
                    }

                    if (temp[1][0] === '+' && config.OPTAB[temp[1].slice(1)]) {
                        LOC += 4;
                    }

                    if (config.OPTAB[temp[1]]) {
                        if (temp[1].endsWith('R')) {
                            LOC += 2;
                        } else {
                            LOC += 3;
                        }
                    } else if (temp[1] === 'BYTE') {
                        const firstQuote = temp[2].indexOf("'");
                        const secondQuote = temp[2].indexOf("'", firstQuote + 1);
                        const trimmedStr = temp[2].substring(firstQuote + 1, secondQuote);
                        Interfile.push(`${LOC.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
                        SYMTAB[temp[0]] = LOC.toString(16).toUpperCase().padStart(4, '0');
                        LOC += temp[2][0] === 'C' ? trimmedStr.length : Math.ceil(trimmedStr.length / 2);
                    } else if (temp[1] === 'RESB') {
                        Interfile.push(`${LOC.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
                        SYMTAB[temp[0]] = LOC.toString(16).toUpperCase().padStart(4, '0');
                        LOC += parseInt(temp[2], 10);
                    } else if (temp[1] === 'RESW') {
                        Interfile.push(`${LOC.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
                        SYMTAB[temp[0]] = LOC.toString(16).toUpperCase().padStart(4, '0');
                        LOC += 3 * parseInt(temp[2], 10);
                    } else if (temp[1] === 'WORD') {
                        Interfile.push(`${LOC.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
                        SYMTAB[temp[0]] = LOC.toString(16).toUpperCase().padStart(4, '0');
                        LOC += 3;
                    } else if (temp[1] === 'EQU') {
                        if (temp[2] === '*') {
                            Interfile.push(`${LOC.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
                            SYMTAB[temp[0]] = LOC.toString(16).toUpperCase().padStart(4, '0');
                        } else {
                            let subtract = -1;
                            let add = -1;
                            let operator_num = 0;
                            
                            subtract = temp[2].indexOf('-');
                            add = temp[2].indexOf('+');
                            
                            operator_num = (temp[2].match(/\-/g) || []).length + (temp[2].match(/\+/g) || []).length;
                            
                            if (operator_num === 1) {
                                let op1 = '';
                                let op2 = '';
                                let res = 0;
                                if (subtract !== -1) {
                                    op1 = temp[2].substring(0, subtract);
                                    op2 = temp[2].substring(subtract + 1);
                            
                                    if (op1 in SYMTAB && op2 in SYMTAB) {
                                        res = parseInt(SYMTAB[op1], 16) - parseInt(SYMTAB[op2], 16);
                                    } else if (!isNaN(op1) && !isNaN(op2)) {
                                        res = parseInt(op1) - parseInt(op2);
                                    } else if (!isNaN(op1)) {
                                        res = parseInt(op1) - parseInt(SYMTAB[op2], 16);
                                    } else {
                                        res = parseInt(SYMTAB[op1], 16) - parseInt(op2);
                                    }
                                } else {
                                    op1 = temp[2].substring(0, add);
                                    op2 = temp[2].substring(add + 1);
                                    
                                    if (op1 in SYMTAB && op2 in SYMTAB) {
                                        res = parseInt(SYMTAB[op1], 16) + parseInt(SYMTAB[op2], 16);
                                    } else if (!isNaN(op1) && !isNaN(op2)) {
                                        res = parseInt(op1) + parseInt(op2);
                                    } else if (!isNaN(op1)) {
                                        res = parseInt(op1) + parseInt(SYMTAB[op2], 16);
                                    } else {
                                        res = parseInt(SYMTAB[op1], 16) + parseInt(op2);
                                    }
                                }
                                SYMTAB[temp[0]] = res.toString(16).toUpperCase().padStart(4, '0');
                                Interfile.push(`${res.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
                            } else {
                                let res = 0;
                                let op1 = '';
                                let op2 = '';
                                let buf = '';
                                let operator = '';
                            
                                for (let character of temp[2]) {
                                    if (character === ' ') {
                                        continue;
                                    } else if (character !== '+' && character !== '-') {
                                        buf += character;
                                    } else {
                                        if (op1 === '') {
                                            op1 = buf;
                                            buf = '';
                                        } else if (op2 === '') {
                                            op2 = buf;
                                            buf = '';
                                        }
                            
                                        if (op1 !== '' && op2 !== '' && operator !== '') {
                                            if (operator === '+') {
                                                if (op1 in SYMTAB && op2 in SYMTAB) {
                                                    res = parseInt(SYMTAB[op1], 16) + parseInt(SYMTAB[op2], 16);
                                                } else if (!isNaN(op1) && !isNaN(op2)) {
                                                    res = parseInt(op1) + parseInt(op2);
                                                } else if (!isNaN(op1)) {
                                                    res = parseInt(op1) + parseInt(SYMTAB[op2], 16);
                                                } else {
                                                    res = parseInt(SYMTAB[op1], 16) + parseInt(op2);
                                                }
                                            } else if (operator === '-') {
                                                if (op1 in SYMTAB && op2 in SYMTAB) {
                                                    res = parseInt(SYMTAB[op1], 16) - parseInt(SYMTAB[op2], 16);
                                                } else if (!isNaN(op1) && !isNaN(op2)) {
                                                    res = parseInt(op1) - parseInt(op2);
                                                } else if (!isNaN(op1)) {
                                                    res = parseInt(op1) - parseInt(SYMTAB[op2], 16);
                                                } else {
                                                    res = parseInt(SYMTAB[op1], 16) - parseInt(op2);
                                                }
                                            }
                                            op1 = res.toString();
                                            op2 = '';
                                            operator = '';
                                            res = 0;
                                        }
                                        operator = character;
                                    }
                                }
                            
                                op2 = buf;
                            
                                if (operator === '+') {
                                    if (op1 in SYMTAB && op2 in SYMTAB) {
                                        res += (parseInt(SYMTAB[op1], 16) + parseInt(SYMTAB[op2], 16));
                                    } else if (!isNaN(op1) && !isNaN(op2)) {
                                        res += (parseInt(op1) + parseInt(op2));
                                    } else if (!isNaN(op1)) {
                                        res += (parseInt(op1) + parseInt(SYMTAB[op2], 16));
                                    } else {
                                        res += (parseInt(SYMTAB[op1], 16) + parseInt(op2));
                                    }
                                } else if (operator === '-') {
                                    if (op1 in SYMTAB && op2 in SYMTAB) {
                                        res += (parseInt(SYMTAB[op1], 16) - parseInt(SYMTAB[op2], 16));
                                    } else if (!isNaN(op1) && !isNaN(op2)) {
                                        res += (parseInt(op1) - parseInt(op2));
                                    } else if (!isNaN(op1)) {
                                        res += (parseInt(op1) - parseInt(SYMTAB[op2], 16));
                                    } else {
                                        res += (parseInt(SYMTAB[op1], 16) - parseInt(op2));
                                    }
                                }
                                op1 = '';
                                op2 = '';
                                operator = '';
                                SYMTAB[temp[0]] = res.toString(16).toUpperCase().padStart(4, '0');
                                Interfile.push(`${res.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
                                res = 0;
                            }
                        }
                    }
                } else {
                    Interfile.push(`${LOC.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
                }
            }
        } else if (temp.length === 2) {
            if (temp[0] === '.') {
                Interfile.push(`${LOC.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
            } else if (place1[0] === '+') {
                const t = place1.slice(1);
                if (config.OPTAB[t]) {
                    Interfile.push(`${LOC.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
                    LOC += 4;
                }
            } else if (config.OPTAB[place1]) {
                if (place1.endsWith('R')) {
                    Interfile.push(`${LOC.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
                    LOC += 2;
                } else {
                    Interfile.push(`${LOC.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
                    LOC += 3;
                }
            } else if (temp[0] === 'BASE') {
                Interfile.push(`${LOC.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
            } else if (temp[0] === 'END') {
                Interfile.push(`${LOC.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
            } else {
                Interfile.push(`${LOC.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
                LOC += 3;
            }
        } else {
            if (temp[0] === '.') {
                Interfile.push(`${LOC.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
            } else if (temp[0] === 'JSUB' || temp[0] === 'RSUB') {
                Interfile.push(`${LOC.toString(16).toUpperCase().padStart(4, '0')} ${line}`);
                LOC += 3;
            }
        }
    });
    return {Interfile, SYMTAB, ProgramName};
}
