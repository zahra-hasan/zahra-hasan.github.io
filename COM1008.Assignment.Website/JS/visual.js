"use strict";

// main program

var canvas = document.getElementById("canvas");
var context = canvas.getContext("2d");


//Arrays to store main values for the bar and pie charts

var activityName = ["STUDYING", "PAINTING", "EXERCISING"];
var activityDone = [[180,120,60],[240,120,180],[360,30,150],[180,30,12],[60,60,180],[300,150,90],[240,60,60]];
var weekDays = ["MONDAY" ,"TUESDAY" ,"WEDNESDAY" ,"THURSDAY" ,"FRIDAY" ,"SATURDAY" ,"SUNDAY"]
var colors = ["green","red","blue"];

//main function to reset the canvas 

function resetcanvas() {
  context.clearRect(0,0,canvas.width,canvas.height);
}


var li = document.getElementById("listing");


//the functions:

//1- function to generate random colors connected to the array colors[]

function changeColor(){
    for (var i=0; i<3; i++){
      var r = Math.floor(Math.random()*250);
      var g = Math.floor(Math.random()*250);
      var b = Math.floor(Math.random()*256);
      var color = "rgb("+r+","+g+","+b+")";
      colors[i] = color;
    }  
}

//varuables and constants used for the second function drawbars()

var barWidth = 60;
var startX = 70;
const MAX_DAYS = 7; //this constant also used in drawPie()
var day = 0; //this variable also used in drawPie()

//2- function to draw the bars chart for on day at a time

function drawbars() {
    showPieChart.innerHTML="show Pie chart"; //reset pie chart button
    showNextDay.innerHTML="Show next day"; //change bar chart button
    context.clearRect(0,0,canvas.width,canvas.height); //reset canvas
    if (day<MAX_DAYS){
      for (var i=0; i<3; i++) { //iterate over 3 activities
        context.fillStyle = colors[i]; //iterate over colors
        var bar = activityDone[day][i]; //iterate over activites times
        //draw the bar
        context.fillRect(startX, canvas.height -bar , barWidth , bar);
        //lable bar
        context.font = "10pt Arial";
        context.strokeRect(startX, canvas.height -bar , barWidth , bar);
        context.fillStyle = "black";
        context.fillText(activityName[i], startX, canvas.height-bar-10);
        startX += barWidth+40;
        //lable the bar chart fot the day
        li.style.listStyle = "none";
        li.style.padding = "5px";
        li.textContent = weekDays[day];
    } 
    //adjust vlaues
    startX = 70; 
    day++;
    }
    //reset values
    else if (day == MAX_DAYS) {
    day=0;
    showNextDay.innerHTML="show bar";
    li.textContent = null;
    }
   
}

//varuables and constants used for the third function drawPie()

const PI2 = Math.PI*2;
const centerX = canvas.width/2;
const centerY = canvas.height/2;
const radius = 150;
var StartAngle = 0;

//2- function to draw the pie chart for on day at a time

function drawPie() {
    showNextDay.innerHTML="show bar";
    showPieChart.innerHTML="show Next Day";
    context.clearRect(0,0,canvas.width,canvas.height);
    if (day<MAX_DAYS){
      for (var i=0; i<3; i++) { //iterate over 3 activities
      var total = 0;
      for (var j=0; j<3; j++) { //get the total time spent in one day
        total += activityDone[day][j];
      }
      var slice = (activityDone[day][i])*PI2/total; //calculate arc size
      var endAngle = StartAngle+slice; //calculate the end angle size
      //draw the arc
      context.beginPath();
      context.moveTo(centerX,centerY);
      context.arc(centerX,centerY,radius,StartAngle,endAngle,false);
      context.closePath();
      context.fillStyle = colors[i];
      context.strokeStyle = colors[i];
      context.fill();
      StartAngle = 0;
      StartAngle += endAngle;
      //lable the pie chart for the day
      li.style.listStyle = "none";
      li.style.padding = "5px";
      li.textContent = weekDays[day];
      } 
    //adjust values
    day++;
    } 
    //reset values
    else if (day == MAX_DAYS) {
      day=0;
      showPieChart.innerHTML="show Pie chart";
      li.textContent = null;
    }
}


//getting elemnts from datavisualisation.html file
var changeColorButton = document.getElementById("changecolors");
var showNextDay = document.getElementById("showNextDay");
var showPieChart = document.getElementById("showPie");

//onclick events
showNextDay.addEventListener("click", drawbars);
changeColorButton.addEventListener("click", changeColor);
showPieChart.addEventListener("click", drawPie);




