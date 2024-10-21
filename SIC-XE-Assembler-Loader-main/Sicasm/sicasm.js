import {error_scan} from "./Error_Scan.js";
import {pass1} from "./Pass1.js";
import {pass2} from "./Pass2.js";

let asmContent = "";
const asmUploader = document.querySelector('#asmUploader');
const asmName = document.querySelector('#asmName');
const fileNameContent = document.querySelector('#fileNameContent');
asmName.addEventListener('click',()=>{
    asmUploader.click()
})

asmUploader.addEventListener('change', (e) => {
    const file = e.target.files[0];
    asmName.textContent = e.target.files[0].name;
    if (file && file.type === 'text/plain') {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function (e) {
            asmContent = e.target.result;
        };
    } else {
        alert('請上傳文字檔');
    }
});

function main() {
    if (error_scan(asmContent)) {
        try {
            const { Interfile, SYMTAB, ProgramName } = pass1(asmContent);
            let fileName = fileNameContent.value;
            pass2(Interfile, SYMTAB, ProgramName, fileName);
        } catch (e) {
            console.log(e)
            if (e.name === "PCBaseERROR") {
                console.log(e.msg)
                console.log("程式因錯誤暫停執行!!")
            } else if (e.name === "ExpressionERROR") {
                console.log(e.msg)
                console.log("程式因錯誤暫停執行!!")
            } else {
                console.log("程式因不明錯誤暫停執行!!")
            }
        }
    } else {
        console.log("程式因錯誤暫停執行!!")
    }
}

window.main = main
