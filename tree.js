var attr = function(attr) { return function(elm) {return elm[attr]; } };
var flatEqual = function(a, b) { return JSON.stringify(a) == JSON.stringify(b); };

var Tree = function(bonds) {
	this.bonds = (bonds.length ? bonds : bonds.bonds).map(function(bond) {
		return bond.from ? bond : {
			from: bond[0],
			to: bond[1],
			bonds: bond[2]
		};
	});	
	this.endpoints = { start: "", end: "" };
};
Tree.prototype = {
	formRules: function(points) {
		var rules = [];		
		[[1,1], [-1,1], [-1,-1], [1,-1]].forEach(function(multipliers) {
			points.forEach(function(point) {			
				rules.push([multipliers[0] * point[0], multipliers[1] * point[1]]);
			});
		});
		var chain = {};
		chain[rules[0]] = rules[1];
		rules.reduce(function(prev, current) {
			chain[prev] = current;
			return current;
		});
		chain[rules.pop()] = rules[0];
		return chain;
	},
	nextDirection: function(directions, preference) {
		// After making a bond, decide in what direction the next bond...
		// ... should be made.
		directions = directions.slice().reverse();		
		var next = this.formRules([[.9, .4], [.7, .7], [.4, .9]]);
		
		// Allow a preferred direction to be taken, useful in making organic...
		// ... look as they are usually seen, i.e., in making C-C bonds...
		// ... horizontal.
		if( preference && directions.indexOf(preference) == -1 ) return preference;
		
		for( var k in directions ) {
			var direction = directions[k];
			if( directions.indexOf(next[direction]) == -1 ) return next[direction];
		}
		return [0,0];
	},	
	inverseDirection: function(direction) {
		// After making a bond to another atom, decide in which direction...
		// ... it should start in making its own bonds.		
		var invert = function(x){return -1*x;};
		var inverse = JSON.parse(JSON.stringify(this.formRules([[.9, .4], [.7, .7], [.4, .9]])), function(a,b){return b.map ? a.split(',').map(invert) : b});
		console.log(inverse);
		return inverse[direction+""];
	},
	coordinateTaken: function(coordinates, coordinate) {
		// Avoid placing two atoms in the exact same spot.
		for( var k in coordinates ) {
			if( flatEqual(coordinates[k], coordinate) ) return true;
		}
		return false;
	},
	coordinates: function(coordinates, haveAssignedOrigin, directions) {
		// Decide coordinates for all atoms based on a single initial...
		// ... position and relative position derived from bonds. To...
		// ... combat the issue of an atom's `dependencies` coming after...
		// ... it we recurse if any are not yet placed.
		var tree = this;
		var directions = directions || {},
			coordinates = coordinates || {},
			haveAssignedOrigin = haveAssignedOrigin || false,
			unknowns = [];
			
		this.bonds.forEach(function(branch) {			
			if( !coordinates[branch.from] && coordinates[branch.to] ) {
				var to = branch.from;
				branch.from = branch.to;
				branch.to = to;
			} else if( !coordinates[branch.from] && !haveAssignedOrigin ) {
				coordinates[branch.from] = [0,0];
				haveAssignedOrigin = true;
			} else if( !coordinates[branch.from] ) {
				unknowns.push(branch);
				return;
			}	
						
			directions[branch.from] = directions[branch.from] || [[.9, .4]];	
			directions[branch.to] = directions[branch.to] || [];					
			
			// For bonds at a start point, try to go the opposite direction of the end point
			var preferredDirection;
			if( branch.from == tree.endpoints.start[1] || branch.to == tree.endpoints.start[1] ) {
				preferredDirection = [0,1];
			} else if( branch.from == tree.endpoints.end[1] || branch.to == tree.endpoints.end[1] ) {
				preferredDirection = [0,-1];
			}
			
			// Place the new atom in a given direction relative to the atom to...
			// ... which it is bonded.
			var direction = tree.nextDirection(directions[branch.from], preferredDirection);			
			directions[branch.from].push(direction);
			directions[branch.to].push(tree.inverseDirection(direction));						
			var shiftCoords = coordinates[branch.from].map(function(from,i){return from+direction[i]});
			
			// Change direction or move outward until the proposed location of...
			// ... the new atom is not already occupied. This serves as a sort of...
			// ... fallback plan to avoid overlaps at all costs.
			while( true ) {
				if( tree.coordinateTaken(coordinates, shiftCoords) && directions.length == 4 ) {
					shiftCoords = shiftCoords.map(function(from,i){return from+[1,1][i]});
				} else if( tree.coordinateTaken(coordinates, shiftCoords) ) {
					direction = tree.nextDirection(directions[branch.from]);
					directions[branch.from].push(direction);
					directions[branch.to].push(tree.inverseDirection(direction));
					shiftCoords = coordinates[branch.from].map(function(from,i){return from+direction[i]});
				} else {
					coordinates[branch.to] = shiftCoords;					
					break;
				}
			}			
		});
		
		if( unknowns.length ) {				
			var tree = new Tree({ method: "recurse", endpoints: tree.endpoints, bonds: unknowns});
			var add = tree.coordinates(coordinates, haveAssignedOrigin, directions);
			for( var k in add ) {
				coordinates[k] = add[k];
			}
		}
		
		return coordinates;
	},
	bondLines: function() {
		// Map bonds between elements to bonds between coordinates.
		var coords = this.coordinates();
		return this.bonds.map(function(bond) {
			return { from: coords[bond.from], to: coords[bond.to], bonds: bond.bonds };
		});
	},
	context: {
		// A set of functions for dealing with a canvas context that handle...
		// ... scaling and recording of points for testing.
		points: [],
		line: function(ctx, p1, p2, shift) {
			var size = this.window.size, 
				xOffset = this.window.xOffset,
				yOffset = this.window.yOffset;
			var x1 = p1[0], x2 = p2[0], y1 = p1[1], y2 = p2[1];
			ctx.lineWidth = size/30;
			if( x1 == x2 ) {
				ctx.moveTo(size*(x1+xOffset)+shift*size/15, size*(y1+yOffset)); 
				ctx.lineTo(size*(x2+xOffset)+shift*size/15, size*(y2+yOffset));
			} else {
				ctx.moveTo(size*(x1+xOffset), size*(y1+yOffset)+shift*size/15); 
				ctx.lineTo(size*(x2+xOffset), size*(y2+yOffset)+shift*size/15);				
			}
			this.points.push({ type: "line", points: [p1, p2] });
		},
		arc: function(ctx, x,y) { 
			var size = this.window.size,
				xOff = this.window.xOffset,
				yOff = this.window.yOffset;
			ctx.arc(size*(x+xOff),size*(y+yOff),size/6,0,Math.PI*2);
			this.points.push({ type: "circle", points: [x,y] }); 
		},
		fillText: function(ctx, txt, x,y) {
			var size = this.window.size;
			ctx.font = "bold "+Math.floor(size/5)+"px Arial";
			ctx.fillText(txt, this.window.size*(x+this.window.xOffset)-size/8,this.window.size*(y+this.window.yOffset)+size/12);
		}
	},
	window: function() {
		// Decide scale and position at which to draw the molecule.
		var coords = [], treeCoords = this.coordinates();
		for( var k in treeCoords ) coords.push(treeCoords[k]);
		
		var xRange = {
			from: Math.min.apply({}, coords.map(attr(0))),
			to: Math.max.apply({}, coords.map(attr(0)))
		};
		var yRange = {
			from: Math.min.apply({}, coords.map(attr(1))),
			to: Math.max.apply({}, coords.map(attr(1)))
		};
		return {
			size: 600/(Math.max(xRange.to-xRange.from, yRange.to-yRange.from)+2),
			xOffset: -1 * (xRange.from-1),
			yOffset: -1 * (yRange.from-1)
		};
	},
	draw: function(ctx) {
		// Draw the molecule's atoms and bonds.
		var tree = this;
		this.context.points = [];	
		this.context.window = this.window();	
		
		// Render the bonds between atoms.
		this.bondLines().forEach(function(bond) {
			ctx.beginPath();		
			ctx.strokeStyle = 'black';
			
			if( bond.bonds == '2' ) {
				tree.context.line(ctx, bond.from, bond.to, 1);
				tree.context.line(ctx, bond.from, bond.to, -1);
			} else if( bond.bonds == '3' ) {
				tree.context.line(ctx, bond.from, bond.to, 1.5);
				tree.context.line(ctx, bond.from, bond.to, 0);
				tree.context.line(ctx, bond.from, bond.to, -1.5);
			} else {
				tree.context.line(ctx, bond.from, bond.to, 0);
			}
			
			ctx.stroke();
		});
		
		// Render the atoms whose bonds we have already drawn.
		var coordinates = this.coordinates();		
		for(var k in coordinates) {
			var xy = coordinates[k];

			ctx.beginPath();
			ctx.fillStyle = k.split(',')[1];
			
			tree.context.arc(ctx, xy[0], xy[1]);			
			ctx.fill();
			ctx.lineWidth = 2;
			ctx.stroke();
						
			ctx.fillStyle = '#000';						
			tree.context.fillText(ctx, k.split(',')[0], xy[0], xy[1]);			
		}
		return this.context.points;
	}
};