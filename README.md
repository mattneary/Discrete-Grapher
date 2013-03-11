Introduction
============
This library is a portion of the code used in [Bonds.io](http://bonds.io). Input a list of edges, between two points, with the number of edges to be included in this relation (i.e., bond count), and render them on a canvas element. Make sure to include the RGB color of a vertex in its name, e.g., `"A,#0f0"`.

Usage
=====
```javascript
var cvs = document.getElementById('cvs'),
	ctx = cvs.getContext('2d');	

var tree = new Tree([
	["A,#0f0", "B,#0f0", 1],
	["B,#0f0", "C,#0f0", 1],
	["C,#0f0", "A,#0f0", 1]
]);
tree.draw(ctx);
```