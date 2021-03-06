var that;
var textList = ["With Great Power Comes Great Responsibility".toUpperCase(),
        "he makes us watch the Discovery Channel all day long".toUpperCase(),
        "How about we all go out to dinner tomorrow night".toUpperCase(),
        "I'm gonna make him an offer he can't refuse".toUpperCase(),
        "do you want to build a snowman".toUpperCase(),
        "If happiness knocks on your door, let it come in".toUpperCase()
        ];
var text;
var validChar = {"A":0,"B":0,"C":0,"D":0,"E":0,"F":0,"G":0,"H":0,"I":0,"J":0,"K":0,"L":0,"M":0,"N":0,"O":0,"P":0,"Q":0,"R":0,"S":0,"T":0,"U":0,"V":0,"W":0,"X":0,"Y":0,"Z":0,",":0,".":0," ":0,"'":0};
var charLen;
var validCharStr = JSON.stringify(validChar);
var index;
var thisValidChar;
var counts;
var totalCount;

function initInputBox(callback){
    console.log(2);
    var inputbox = '<div class="box"><input type="text" class="letter"><p>0</p></div>';
    var inputfield = $('#inputfield');
    var i;
    for (i = 0; i < text.length; i++) {
        inputfield.append(inputbox);
    }

    totalCount = 0;
    counts = new Array();
    charLen = Object.keys(validChar).length;
    for (i = 0; i <= charLen; i++) {
        counts.push(0);
    }
    thisValidChar = JSON.parse(validCharStr);

    callback.apply(this,[]);
}

function init(callback) {
    // randomly select a sentence
    var textId = Math.floor(Math.random() * (textList.length - 0) + 0); //[)
    text = textList[textId];
    $('#textId')[0].innerText = (textId+1);
    console.log(1);
    callback.apply(this,[]);
}

init(function(){
  initInputBox(function(){
  })
});



function getEntropy(nLetter) {
    var entropy = 0;
    for (var i = 1; i <= charLen; i++) {
        if (counts[i] == 0) continue;
        entropy -= counts[i] / nLetter * Math.log(counts[i] / nLetter);
    }
    $('#entropy')[0].innerText = entropy / Math.log(2);
    $('#perplexity')[0].innerText = Math.pow(2,entropy);
}

$(function() {

    $('input:text:first').focus();
    var $inp = $('.letter');
    // $inp.bind('keydown', function(){
    //     this.value = this.value.toUpperCase();
    //     console.log(this.value)
    // } );
    $inp.bind('keyup', function(e) {
        // that = this;
        var value = this.value[0].toUpperCase(); // catch only 1st letter
        index = $inp.index(this);
        var ans = text[index];
        var count;
        if (ans == value) {
            // console.log("correct");
            count = $(this).siblings()[0].textContent;
            var newcount = parseInt(count) + 1;
            counts[newcount] += 1;
            totalCount += newcount;
            $(this).siblings()[0].textContent = newcount;
            // go to next box
            $(".letter:eq(" + (index+1) + ")").focus();
            thisValidChar = JSON.parse(validCharStr);

            $.ajax({
                url: "http://77e1486a.ngrok.io/shannon?q="+newcount,
                type: "GET",
                crossDomain: true,
                success: function (response) {
                    var resp = JSON.parse(response)
                    console.log(resp)
                },
                error: function (xhr, status) {
                    console.log("error");
                }
            });

            getEntropy(index+1);
        } else {
            if (thisValidChar[value] == 0) {
                // console.log("wrong");
                thisValidChar[value] = 1;
                count = $(this).siblings()[0].textContent;
                $(this).siblings()[0].textContent = parseInt(count) + 1;
            }
            value = "";
        }
        this.value = value;
    });
});
