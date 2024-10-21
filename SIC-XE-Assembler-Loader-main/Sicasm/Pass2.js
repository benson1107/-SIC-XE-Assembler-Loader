import config from "./config.json" with {type: "json"};

let output = []
let objectCode = ""
let base = ""
let symbolType = {}
let modificationLine = []
let fileName = ""

const showLst = document.querySelector('#showLst');
const showObj = document.querySelector('#showObj');
const lstDownload = document.querySelector('#lstDownload')
const objDownload = document.querySelector('#objDownload')

lstDownload.addEventListener('click', () => {
    let blob = new Blob([showLst.textContent], {
        type: "application/octet-stream",
    })
    let url = window.URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.lst`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
})

objDownload.addEventListener('click', () => {
    let blob = new Blob([showObj.textContent], {
        type: "application/octet-stream",
    })
    let url = window.URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.obj`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
})

function PCBaseERROR(msg) {
    this.name = 'PCBaseERROR'
    this.msg = msg
}

function ExpressionERROR(msg) {
    this.name = 'ExpressionERROR'
    this.msg = msg
}

PCBaseERROR.prototype = new Error()
PCBaseERROR.prototype.constructor = PCBaseERROR

ExpressionERROR.prototype = new Error()
ExpressionERROR.prototype.constructor = ExpressionERROR

function handleDirective(index, line, directive, operand, SYMTAB) {
    if (directive === 'START') {
        output.push(`${`${index}`.padEnd(2, " ")} LOC=${line[0]}  none`)
    } else if (directive === 'BASE') {
        base = SYMTAB[operand]
        output.push(`${`${index}`.padEnd(2, " ")} LOC=${line[0]}  none`)
    } else if (directive === 'BYTE') {
        objectCode = ''
        if (operand[0] === 'C') {
            // 要儲存字串
            let string = operand.split("'")[1] //取欲儲存的字串
            for (let char of string)
                objectCode += char.charCodeAt(0).toString(16).toUpperCase() // 將字串轉換為十六進位的ASCII
        } else if (operand[0] === 'X') {
            // 要儲存十六進位
            objectCode = operand.split("'")[1].toUpperCase() //取欲儲存的十六進位(2個十六進位組成一個BYTE)
        }
        output.push(`${`${index}`.padEnd(2, " ")} LOC=${line[0]}  ${objectCode}, BYTE`)
    } else if (directive === 'WORD') {
        if (operand.includes('+') || operand.includes('-')) {
            let expression = operand
            objectCode = calExpression(expression, SYMTAB).padStart(6, '0')
        } else {
            objectCode = parseInt(operand).toString(16).toUpperCase().padStart(6, '0')
        }
        output.push(`${`${index}`.padEnd(2, " ")} LOC=${line[0]}  ${objectCode}, WORD`)
    } else {
        // 處理 RESB RESW EQU END
        output.push(`${`${index}`.padEnd(2, " ")} LOC=${line[0]}  none`)
    }
}

function calNegativeHex(integer) { //negInteger2Hex
    return (parseInt('FFF', 16) - Math.abs(integer) + 1).toString(16).toUpperCase()
}

function calExpression(expression, SYMTAB) {
    /* Input 為 expression，
    Output為 expression計算後的結果(16進位)*/
// 將SYMTAB中的Symbol替換為對應的address
    const sortedKeys = Object.keys(SYMTAB).sort((a, b) => b.length - a.length);
    for (const symbol of sortedKeys) {
        expression = expression.toUpperCase().replace(symbol, parseInt(SYMTAB[symbol], 16))
    }
    let result = eval(expression)
    if (result < 0)
        return parseInt(calNegativeHex(result), 16).toString(16).toUpperCase()
    else
        return result.toString(16).toUpperCase()
}

function calOpcodeniHex(opcode, isIndirect, isImmediate) {
    /*Input: opcode(10進位), isIndirect(是否為間接定址), isImmediate(是否為立即定址)
       return opcode_ni_hex(opcode加上ni後的兩個16進位)*/
    let ni
    if (!isIndirect && !isImmediate) {
        // simple addressing (n=1, i=1)
        ni = 3
    } else {
        ni = parseInt(`${isIndirect}${isImmediate}`, 2)
    }
    // return opcode_ni_hex(opcode加上ni後的兩個16進位)
    return (opcode + ni).toString(16).toUpperCase().padStart(2, '0')
}

function calDispHex(pc, base, TA) {
    /*Input: PC位址, BASE位址, TA位址
       return isPC, isBase, isRrror, HexDisp(3個16進位的disp)*/
    // 計算disp與決定用哪種relative
    let intDisp = parseInt(TA, 16) - parseInt(pc, 16)  // 10進位的disp(pc與TA的距離)
    if (-2048 <= intDisp && intDisp <= 2047) {  // 是否符合 pc relatuve
        // return isPC(1), isBase(0), isError(0), 3個16進位的disp
        if (intDisp >= 0) {
            return {isPC: 1, isBase: 0, isError: 0, HexDisp: intDisp.toString(16).toUpperCase().padStart(3, '0')}
        } else {
            return {isPC: 1, isBase: 0, isError: 0, HexDisp: calNegativeHex(intDisp)}
        }
    } else {
        intDisp = parseInt(TA, 16) - parseInt(base, 16)  // 10進位的disp(base與TA的距離)
        if (0 <= intDisp <= 4095) {  // 是否符合 base relative
            // return isPC(0), isBase(1), isError(0) ,3個16進位的disp
            return {isPC: 0, isBase: 1, isError: 0, HexDisp: intDisp.toString(16).toUpperCase().padStart(3, '0')}
        } else {
            // return isPC(0), isBase(0), isError(1), 000
            return {isPC: 0, isBase: 0, isError: 1, HexDisp: '000'}  // 皆不能的話表示有ERROR
        }
    }
}

function handleOP(index, line, pc, base, mnemonic, operand, SYMTAB) {
    let isFormat2 = 0
    let isFormat4 = 0
    let isPC = 0
    let isBase = 0
    let isError = 0
    let isImmediate = 0
    let isIndirect = 0
    let isIndexed = 0

    let loc = line[0]
    let xbpeHex = 'A'

    // format 2
    if (config.Format2_mnemonic.includes(mnemonic)) {
        isFormat2 = 1
    }
    // format 4
    else if (mnemonic[0] === '+') {
        mnemonic = mnemonic.slice(1)
        isFormat4 = 1
    }

    // immediate 、 indirect 與 indexed 為互斥的
    if (operand[0] === '#') {
        // immediate addressing
        isImmediate = 1
        operand = operand.slice(1)
    } else if (operand[0] === '@') {
        // indirect addressing
        isIndirect = 1
        operand = operand.slice(1)
    } else if (operand.includes(',X') && !isFormat2) {
        // indexed addressing
        isIndexed = 1
        operand = operand.split(',')[0]
    }
    if (isFormat2) {
        // 處理format 2
        let opcode = config.OPTAB[mnemonic]  // 16進位的opcode
        operand = operand.split(',')
        if (operand.length === 2)
            objectCode = `${opcode}${config.Register[operand[0]]}${config.Register[operand[1]]}`
        else
            objectCode = `${opcode}${config.Register[operand[0]]}0`
    } else if (isFormat4) {
        let addressHex
        // 處理format 4
        if (isImmediate && !(operand in SYMTAB)) {
            // immediate addressing
            // 且 operand 為常數 => disp 為該常數的十六進位
            addressHex = parseInt(operand).toString(16).toUpperCase().padStart(5, '0')
        }
        // 判斷是否有expression，有的話需要特別處理，沒有的話address欄位可以直接填
        else {
            if (operand.includes('+') || operand.includes('-')) {
                addressHex = calExpression(operand, SYMTAB).padStart(5, '0') //operand = expression
            } else {
                addressHex = SYMTAB[operand].padStart(5, '0')  // 5個16進位的絕對位址
            }
        }
        // 算opcode+ni的16進位字元(2個字元)
        let opcode = parseInt(config.OPTAB[mnemonic], 16)  // 10進位的opcode
        let opcodeniHex = calOpcodeniHex(opcode, isIndirect, isImmediate)
        // xbpe的字串
        xbpeHex = parseInt(`${isIndexed}${isBase}${isPC}${isFormat4}`, 2).toString(16).toUpperCase()
        objectCode = `${opcodeniHex}${xbpeHex}${addressHex}`
    } else {
        let HexDisp
        // 處理format 3
        if (isImmediate && !(operand in SYMTAB)) {
            // immediate addressing
            // 且 operand 為常數 => disp 為該常數的十六進位
            HexDisp = parseInt(operand).toString(16).toUpperCase().padStart(3, '0')
        } else {
            let TA
            // 判斷是否有expression，有的話需要特別處理
            if (operand.includes('+') || operand.includes('-')) {
                TA = calExpression(operand, SYMTAB) //operand = expression
            } else {
                TA = SYMTAB[operand]
            }
            let obj = calDispHex(pc, base, TA)
            isPC = obj.isPC
            isBase = obj.isBase
            isError = obj.isError
            HexDisp = obj.HexDisp
            if (isError) {
                throw new PCBaseERROR(`輸入錯誤：第${index}行發生錯誤，PC Relative 與 Base Relative 皆無法使用\n`)
            }
        }
        // 算opcode+ni的16進位字元(2個字元)
        let opcode = parseInt(config.OPTAB[mnemonic], 16)  // 10進位的opcode
        let opcodeniHex = calOpcodeniHex(opcode, isIndirect, isImmediate)

        // xbpe的字串
        xbpeHex = parseInt(`${isIndexed}${isBase}${isPC}${isFormat4}`, 2).toString(16).toUpperCase()
        objectCode = `${opcodeniHex}${xbpeHex}${HexDisp}`

    }
    let nixbpe
    if (isFormat2)
        nixbpe = ''
    else if (!isIndirect && !isImmediate) {
        // simple addressing(n=1,i=1)
        nixbpe = `, nixbpe=11${parseInt(xbpeHex, 16).toString(2).padStart(4, '0')}`  // 11xbpe
    } else {
        nixbpe = `, nixbpe=${isIndirect}${isImmediate}${parseInt(xbpeHex, 16).toString(2).padStart(4, '0')}`
    }  // ??xbpe
    let mode = isFormat2 ? 'format2' : (isFormat4 ? 'format4' : (isPC ? 'pc-relative' : (isBase ? 'base-relative' : 'none')))
    output.push(`${`${index}`.padEnd(2, " ")} LOC=${loc}  ${objectCode}, ${mode}${nixbpe}`)
}

function handleComment(index) {
    output.push(`${`${index}`.padEnd(2, " ")} Comment`)
}

function pass2_1(interFile, SYMTAB) {
    let interFile2 = []
    output.push('=SYMTAB=')
    for (let symbol in SYMTAB) {
        output.push(`${symbol.padEnd(9, " ")}${SYMTAB[symbol]}`)
    }
    output.push('')
    output.push('=OBJECT CODES=')
    let index = 1
    base = ""
    for (let lineStr of interFile) {
        let line = lineStr.trim().split(/\s+/)
        objectCode = 'none'
        for (let element of line) {
            if (config.Assembler_directives.includes(element)) {
                let directive = element
                let operand = line[line.indexOf(element) + 1]
                handleDirective(index, line, directive, operand, SYMTAB)
                interFile2.push({
                    'LOC': line[0],
                    'Symbol': line[1] in SYMTAB ? line[1] : "none",
                    'Instruction': directive,
                    'Operand': operand,
                    'ObjectCode': objectCode
                }) //Line[0]為該指令的LOC
                break
            } else if (element in config.OPTAB || element[0] === '+') {
                if (element !== 'RSUB') {
                    let mnemonic = element
                    let operand = line[line.indexOf(element) + 1]
                    let pc = interFile[interFile.indexOf(lineStr) + 1].trim().split(/\s+/)[0]
                    handleOP(index, line, pc, base, mnemonic, operand.toUpperCase(), SYMTAB)
                    interFile2.push({
                        'LOC': line[0],
                        'Symbol': line[1] in SYMTAB ? line[1] : "none",
                        'Instruction': mnemonic,
                        'Operand': operand,
                        'ObjectCode': objectCode
                    }) //Line[0]為該指令的LOC
                } else {
                    interFile2.push({
                        'LOC': line[0],
                        'Symbol': line[1] in SYMTAB ? line[1] : "none",
                        'Instruction': 'RSUB',
                        'Operand': 'none',
                        'ObjectCode': '4F0000'
                    }) //Line[0]為該指令的LOC
                    output.push(`${`${index}`.padEnd(2, " ")} LOC=${line[0]}  4F0000, none, nixbpe=110000`)
                }
                break
            } else if (element[0] === '.') {
                handleComment(index)
                interFile2.push({
                    'LOC': line[0],
                    'Symbol': line[1] in SYMTAB ? line[1] : "none",
                    'Instruction': 'comment',
                    'Operand': 'comment',
                    'ObjectCode': 'none'
                }) //Line[0]為該指令的LOC
                break
            }
        }
        index += 1
    }
    return {output, interFile2}
}

function buildSymbolTypeTable(SYMTAB) {
    for (let i in SYMTAB) {
        symbolType[i] = 'R'
    }
    return symbolType
}

// 取得expression的type
// step1. 對expression進行切割，並存成list(split_result)
// step2. 把split_result中的symbol和constant更換成各自對應到的type (R -> 1, A -> 0)
// step3. 把整個list轉成字串，並進行計算
// step4. 回傳結果
function getExpressionType(expression) {
    let split_result = expression.split(/([+-])/).filter(item => item !== '') // 對expression進行切割, 移除''的元素
// 把split_result中的symbol和constant更換成各自對應到的type (R -> 1, A -> 0)
    split_result = split_result.map
    (
        item => {
            if (item === '+' || item === '-')
                return item
            else if ((item.toUpperCase() in symbolType ? symbolType[item.toUpperCase()] : item) === 'R')
                return '1'
            else
                return '0'
        }
    )
    split_result = split_result.join('') // 把list轉成字串
    let ans = eval(split_result) // 取得字串計算的結果
    return ans
}

// 檢查expression的結果是合法or不合法(0 -> A)(1 -> R)(other -> 不合法)
// 合法
/*
# 如果EQU有使用expression且expression的type是Absolute -> 需要去修正SymbolType中的Type值為'A'
# 如果其他instruction有使用expression且expression的type是Relative -> 把該行內容儲存於modification_item的list中，方便後續撰寫Modification Record
*/

// 不合法: 跳出錯誤訊息並終止程式
function checkExpression(interFile2) {
    //print('=====  EXPRESSION CHECK  =====')
    for (let line of interFile2) {
        let expression_type
        if (line['Instruction'] === 'EQU') {
            if (line['Operand'] !== '*') {
                expression_type = getExpressionType(line['Operand'])
                if (expression_type === 0) {
                    // 修正SymbolType中的type為'A'
                    symbolType[line['Symbol']] = 'A'
                    //print(f'OK\n{line}')
                } else if (expression_type === 1)
                    continue

                else {
                    throw new ExpressionERROR(`輸入錯誤：${line['Operand']} 發生錯誤，這是不合法的 Expression\n`)
                    break //不合法
                }
            }
        } else if (line['Operand'].includes('+') || line['Operand'].includes('-')) {
            expression_type = getExpressionType(line['Operand'])
            if (expression_type === 0)
                continue
            else if (expression_type === 1) {
                //print(f'OK\n{line}')
                if (line['Instruction'][0] === '+' || line['Instruction'] === 'WORD') {
                    modificationLine.push(line)
                }
            } else {
                throw new ExpressionERROR(`輸入錯誤：${line['Operand']} 發生錯誤，這是不合法的 Expression\n`)
                break //不合法
            }
        }
    }
}

function getModificationLine(interFile2, SYMTAB) {
    for (let line of interFile2) {
        if (line['Instruction'].includes('+')) {
            if (line['Operand'][0] === '#' && !(line['Operand'].slice(1) in SYMTAB))
                continue
            else
                modificationLine.push(line)
        }
    }
    modificationLine.sort((a, b) => {
        // 將 LOC 從 16 進位的字串轉換成整數
        let locA = parseInt(a.LOC, 16)
        let locB = parseInt(b.LOC, 16)

        // 進行排序
        return locA - locB
    })
    return modificationLine
}

// 紀錄header record
function writeHeader(programName, interFile2, SYMTAB) {
    let header_record = []
    let buffer
    let program_name = programName.padEnd(6, ' ')
    let starting_address = SYMTAB[programName].padStart(6, '0')
    let object_program_length = (parseInt(interFile2[interFile2.length - 1]['LOC'], 16) - parseInt(SYMTAB[programName], 16)).toString(16).toUpperCase().padStart(6, '0')
    buffer = 'H' + program_name + starting_address + object_program_length
    header_record.push(buffer)
    return header_record
}

// 紀錄text record
function writeText(programName, interFile2, SYMTAB) {
    // 儲存'T'和starting address和此record的長度(未知，預設為'XX，要把buffer放入text_record前在修正)
    let buffer = 'T' + SYMTAB[programName].toString().padStart(6, '0') + 'XX';
    let textRecord = [];

    for (let line of interFile2) {
        // 判斷是否有object code存在(是：,否：判斷是否換行)
        if (line.ObjectCode === 'none') {
            if (line.Instruction === 'END' && buffer.length !== 0) {
                let length = Math.floor((buffer.length - 9) / 2).toString(16).padStart(2, '0').toUpperCase();
                buffer = buffer.replace('XX', length);
                textRecord.push(buffer);
            } else if (line.Instruction === 'RESW' || line.Instruction === 'RESB') {
                if (buffer.length < 10) {
                    buffer = '';
                } else {
                    // 把buffer的值加入text_record
                    // 清空buffer
                    let length = Math.floor((buffer.length - 9) / 2).toString(16).padStart(2, '0').toUpperCase();
                    buffer = buffer.replace('XX', length);
                    textRecord.push(buffer);
                    buffer = '';
                }
            } else {
                continue;
            }
        } else {
            if ((buffer.length - 9 + line.ObjectCode.length) / 2 > 30) {
                // 把buffer的值加入text_record
                // 清空buffer
                let length = Math.floor((buffer.length - 9) / 2).toString(16).padStart(2, '0').toUpperCase();
                buffer = buffer.replace('XX', length);
                textRecord.push(buffer);
                buffer = 'T' + line.LOC.toString().padStart(6, '0') + 'XX' + line.ObjectCode;
            } else {
                if (buffer.length === 0) {
                    buffer = 'T' + line.LOC.toString().padStart(6, '0') + 'XX';
                }
                buffer += line.ObjectCode;
            }
        }
    }
    return textRecord;
}

// 紀錄modification record
// relative不會是負的
function writeModification(programName) {
    let modification_record = []
    let buffer = ''
    for (let line of modificationLine) { // 要考慮Operand是expression的狀況
        let starting_address
        let modified_length
        if (line['Instruction'].includes('+')) {
            starting_address = (parseInt(line['LOC'], 16) + 1).toString(16).toUpperCase().padStart(6, '0')
            modified_length = '05'
        } else {
            starting_address = line['LOC'].padStart(6, '0')
            modified_length = '06'
        }
        buffer = 'M' + starting_address + modified_length + `+${programName}`
        modification_record.push(buffer)
    }
    return modification_record
}

// 紀錄end record
function writeEnd(programName, SYMTAB) {
    let end_record = []
    let buffer = 'E' + SYMTAB[programName].padStart(6, '0')
    end_record.push(buffer)
    return end_record
}

// 寫檔
function writeFile(headerRecord, textRecord, modificationRecord, endRecord, lst) {
    let data = []
    let content = ""

    lstDownload.disabled = false
    objDownload.disabled = false

    for (let item of lst)
        content += item + '\n'

    showLst.textContent = content

    data.push(headerRecord)
    data.push(textRecord)
    data.push(modificationRecord)
    data.push(endRecord)
    content = ""
    for (let items of data)
        for (let item of items)
            content += item + '\n'

    showObj.textContent = content
}

function pass2_2(programName, obj, SYMTAB) {
    let headerRecord = []
    let textRecord = []
    let modificationRecord = []
    let endRecord = []
    symbolType = buildSymbolTypeTable(SYMTAB) // 初始化symbol type table(type全部預設為'R'，後續在check_expression()時會去修正)
    checkExpression(obj.interFile2) // 檢查expression的結果是合法or不合法
    modificationLine = getModificationLine(obj.interFile2, SYMTAB) // 取得所有要建立modification record的line
    headerRecord = writeHeader(programName, obj.interFile2, SYMTAB) // 紀錄Header Record
    textRecord = writeText(programName, obj.interFile2, SYMTAB) // 紀錄Text Record
    modificationRecord = writeModification(programName) // 紀錄Modification Record
    endRecord = writeEnd(programName, SYMTAB) // 紀錄End Record
    writeFile(headerRecord, textRecord, modificationRecord, endRecord, obj.output) // 輸出結果並存成.obj檔與lst檔
}

export function pass2(interFile, SYMTAB, programName, file) {
    output = []
    objectCode = ""
    base = ""
    symbolType = {}
    modificationLine = []
    fileName = file
    let obj = pass2_1(interFile, SYMTAB)
    pass2_2(programName, obj, SYMTAB)
}
