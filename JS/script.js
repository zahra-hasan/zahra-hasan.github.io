"use strict";

var menubutton = document.getElementsByClassName('menu')[0]
var navbarlinks = document.getElementsByClassName('links')[0]
var bars = document.getElementsByClassName('menubar')[0]

//to toggle the menu bar 
menubutton.addEventListener('click', function(a){
  navbarlinks.classList.toggle('active')})

//to make menu button interactive
bars.addEventListener('click', function(b){
  menubutton.classList.toggle('rotate')
})



