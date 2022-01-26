"use strict";

//main function 

function quiz() {

        //score
    var score = 0;

    //get answers values
    var q1 = document.quizForm.Q1.value;
    var q2 = document.quizForm.Q2.value;
    var q3 = document.quizForm.Q3.value;

    //evaluate answers
    if (q1 == "M&I" ) { score++}
    if (q2 == "RB" ) { score++}    
    if (q3 == "VC" ) { score++}  

    //print out comments based on score
    if (score<2) {document.getElementById("result").innerHTML= "You scored "+score+" ,Are you sure you are studying CS?" ;}
    if (score==2) {document.getElementById("result").innerHTML= "You got two answers right, try again" ;}
    if (score==3) {document.getElementById("result").innerHTML= "Great student, you go them all right!" ;}

    //to make sure all questions have been answered
    if (q1 == 0 || q1 == 0 || q3 == 0) { alert("PLEASE ANSWER ALL THE QUIESTIONS") }
} 



