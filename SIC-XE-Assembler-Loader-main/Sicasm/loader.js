let address = 0
let objContent = ""
let textContent = []
let output = []
const objUploader = document.querySelector('#objUploader');
const objName = document.querySelector('#objName');
const showLoader = document.querySelector('#showLoader');
objName.addEventListener('click', () => {
    objUploader.click()
})

objUploader.addEventListener('change', (e) => {
    const file = e.target.files[0];
    objName.textContent = e.target.files[0].name;
    if (file && (file.type === 'text/plain' || file.name.endsWith('.obj'))) {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function (e) {
            objContent = e.target.result;
        };
    } else {
        alert('請上傳文字檔');
    }
});

function generateAddress() {
    address = Math.floor(Math.random() * 999999) + 1
}

function handleText(line) {
    textContent.push({
        'begin': parseInt(line.substring(1, 7), 16),
        'length': parseInt(line.substring(7, 9), 16),
        'content': line.substring(9)
    })
}

function handleModified(begin, length) {
    for (let item of textContent) {
        if (begin < item.begin + item.length) {
            output.push(`Text: ${item.content}`)
            output.push(`Address: ${address}`)
            output.push(`Address(Hex): ${address.toString(16).toUpperCase()}`)
            if (length % 2 === 1)
                begin = (begin - item.begin) * 2 + 1

            let modifyAddr = item.content.substring(begin, begin + length)
            output.push(`Modify Address: ${modifyAddr}`)
            let intModifyAddr = parseInt(modifyAddr, 16)
            output.push(`Modify Address(Int): ${intModifyAddr}`)
            let result = (address + intModifyAddr).toString(16).toUpperCase()
            output.push(`Result: ${result}`)
            item.content = item.content.substring(0, begin) + result + item.content.substring(begin + length)
            output.push('')
            break
        }
    }
}

function loader() {
    showLoader.textContent = ""
    generateAddress()
    let obj = objContent.split(/\r?\n/)
    textContent = []
    output.push("=MODIFY=")
    for (let line of obj) {
        if (line[0] === 'H')
            continue
        else if (line[0] === 'T') {
            handleText(line)
        } else if (line[0] === 'M') {
            handleModified(parseInt(line.substring(1, 7), 16), parseInt(line.substring(7, 9), 16))
        } else if (line[0] === 'E')
            break
    }

    output.push("=MODIFY TEXT=")
    for (let item of textContent)
        output.push(item.content)

    output.push('')
    output.push("=BINARY FORM=")
    for (let item of textContent) {
        let bin = ""
        for (let hex of item.content) {
            bin += parseInt(hex, 16).toString(2).padStart(4, '0')
        }
        output.push(bin)
        output.push('')
    }

    for (let item of output) {
        showLoader.textContent += item + '\n'
    }
}