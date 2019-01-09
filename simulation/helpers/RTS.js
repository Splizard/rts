var rts = {};

Engine.RegisterMessageType("Signal");

rts.gui = {};

//Component Xml definitions.
rts.Xml = {
	Empty: "<empty/>",
	System: "<a:component type='system'/><empty/>",
};
rts.Schema = rts.Xml;

//Gaia's player ID.
rts.Gaia = 0;

rts.Overlays = [];
rts.EvilOverlays = [];
rts.Orders = [];
rts.States = [];

rts.Init = function() {
	for (let order of rts.Orders) {
		UnitAI.prototype.UnitFsmSpec["Order."+order.name] = order.def
	}
	
	for (let state of rts.States) {
		UnitAI.prototype.UnitFsmSpec.INDIVIDUAL[state.name] = state.def
	}
	
	UnitAI.prototype.UnitFsm = new FSM(UnitAI.prototype.UnitFsmSpec);
}


rts.RegisterOrder = function(name, def) {
	rts.Orders.push({name: name, def: def})
}

rts.RegisterState = function(name, def) {
	rts.States.push({name: name, def: def})
}

rts.Timer = function(entity, component) {
	this.entity = entity;
	this.timer = null;
	this.run = "";
	this.component = component;
	this.interval = 0;
	this.after = 0;
	this.arg = null;
}

rts.Timer.prototype.Run = function(method, arg) {
	this.run = method;
	this.arg = arg;
	return this;
}

rts.Timer.prototype.Every = function(amount) {
	this.interval = amount;
	return this;
}

rts.Timer.prototype.After = function(amount) {
	this.after = amount;
	return this;
}

rts.Timer.prototype.Start = function(amount) {
	if (this.after > 0) 
		return Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer).SetTimeout(this.entity, this.component, this.run, this.after, this.arg);

	return Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer).SetInterval(this.entity, this.component, this.run, this.interval, this.interval, this.arg);
}

rts.RegisterOverlay = function(overlay, permanent) {
	if (permanent) rts.EvilOverlays.push(overlay); else rts.Overlays.push(overlay);
}


//Retrieve the template name.xml
rts.GetTemplate = function(name) {
	if (Engine.QueryInterface(SYSTEM_ENTITY, IID_TemplateManager).TemplateExists(name)) {
		return Engine.QueryInterface(SYSTEM_ENTITY, IID_TemplateManager).GetTemplate(name);
	}
	return null;
}

//Send the player a notification message.
rts.Notify = function(player, msg, type) {
	// Send as time-notification
	let cmpGUIInterface = Engine.QueryInterface(SYSTEM_ENTITY, IID_GuiInterface);
	cmpGUIInterface.PushNotification({
		"players": [player],
		"message": msg,
		"translateMessage": false,
		"type": type
	});
}

//Send the player a notification message.
rts.Popup = function(player, title, msg, icon) {
	// Send as time-notification
	let cmpGUIInterface = Engine.QueryInterface(SYSTEM_ENTITY, IID_GuiInterface);
	cmpGUIInterface.PushNotification({
		"players": [player],
		"translateMessage": false,
		"type": "dialog",

		"dialogName": "popup",
		"data": {
			"realtime": true,
		
			"title": {
				"caption": {
					"message": title,
					"translateMessage": true,
				},
			},
			
			"icon": {
				"sprite": icon,
			},
			
			"text": {
				"caption": {
					"message": msg,
					"translateMessage": true,
				},
			},

		}
	});
}


//Get a system component.
rts.Get = function(id) {
	return Engine.QueryInterface(SYSTEM_ENTITY, id);
}

//Call a component for a specific entity.
rts.Call = function(cmp, id) {
	return Engine.QueryInterface(id, cmp);
}


rts.RegisterSystemComponent = function(component, name, definition) {
	rts.RegisterComponent(component, name, definition, true)
}

rts.GetTemplateName = function(ent) {
	let cmpTemplateManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_TemplateManager);
	return cmpTemplateManager.GetCurrentTemplateName(ent);
}

rts.Detach = function(entity) {
	let cmpEntPosition = Engine.QueryInterface(entity, IID_Position);
	let cmpEntUnitAI = Engine.QueryInterface(entity, IID_UnitAI);
	
	cmpEntPosition.SetTurretParent(INVALID_ENTITY, new Vector3D());
	let cmpEntUnitMotion = Engine.QueryInterface(entity, IID_UnitMotion);
	if (cmpEntUnitMotion)
		cmpEntUnitMotion.SetFacePointAfterMove(true);
	if (cmpEntUnitAI)
		cmpEntUnitAI.ResetTurretStance();
}

rts.RegisterComponent = function(component, name, definition, system) {
	
	//Xml is better than Schema. Nobody knows what the hell a 'Schema' is.
	if (definition.Xml) {
		definition.Schema = definition.Xml;
		definition.Xml = undefined;
	}
	
	//Default to an empty schema.
	if (!definition.Schema && !definition.template) {
		definition.Schema = "<empty/>";
	}
	
	//Generate template.
	if (!definition.Schema && definition.template) {
		definition.Schema = "";
		for (let property in definition.template) {
			
			switch (definition.template[property]) {
				case "text":
					definition.Schema += "<element name='"+property+"' a:help='no help'>\n\t<text/>\n</element>"
					break;
			}
			
		}
		
		definition.template = null;
		print("Schema is ", definition.Schema );
	}
	
	if (definition.OnSignal) {
		definition.OnRangeUpdate = function(msg) {
			if (!this._signal || msg.tag != this._signal) return;
			
			this.OnSignal(msg);
		}
		if (definition.OnDestroy) {
			println();
		}
		definition.OnDestroy = function() {
			// Clean up range query
			var RangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
			if (this._signal)
				RangeManager.DestroyActiveQuery(this._signal);
		}
	}
	
	definition.Component = function() {
		return component;
	}
	
	definition.Get = function(component) {
		return Engine.QueryInterface(this.entity, component);
	}
	definition.NewTimer = function() {
		return new rts.Timer(this.entity, component);
	}
	definition.RefreshStatusBars = function(force) {
		let StatusBars = Engine.QueryInterface(this.entity, IID_StatusBars);
		if (StatusBars && (StatusBars.enabled || force))
			StatusBars.RegenerateSprites();
	}
	definition.GetOwner = function() {
		let Ownership = Engine.QueryInterface(this.entity, IID_Ownership);
		if (Ownership) {
			return Ownership.GetOwner();
		}
		return 0;
	}
	
	definition.Player = function() {
		return QueryOwnerInterface(this.entity);
	}
	
	definition.DistanceTo = function(ent) {
		let Position = Engine.QueryInterface(this.entity, IID_Position)
		if (!Position || !Position.IsInWorld())
			return 0;

		let pos = Position.GetPosition2D();
		
		let ObstructionManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ObstructionManager);
		return ObstructionManager.DistanceToPoint(ent, pos.x, pos.y);
	}
	
	//Attach entity to this entity at the specified offset.
	definition.Attach = function(entity, offset) {
		let cmpPosition = Engine.QueryInterface(entity, IID_Position);
		let cmpTurretPosition = Engine.QueryInterface(this.entity, IID_Position);

		let pos = cmpTurretPosition.GetPosition();
		
		cmpPosition.JumpTo(pos.x, pos.z);
		cmpPosition.SetHeightOffset(0);
		
		cmpPosition.SetYRotation(cmpTurretPosition.GetRotation().y);
		let cmpUnitMotion = Engine.QueryInterface(entity, IID_UnitMotion);
		if (cmpUnitMotion)
			cmpUnitMotion.SetFacePointAfterMove(false);
		cmpPosition.SetTurretParent(this.entity, offset);
		let cmpUnitAI = Engine.QueryInterface(entity, IID_UnitAI);
		if (cmpUnitAI)
			cmpUnitAI.SetTurretStance();
	}
	
	//Spawn foundation ontop of this entity.
	definition.SpawnFoundation = function(template) {
		let Position = Engine.QueryInterface(this.entity, IID_Position);
		let pos = Position.GetPosition();
		let angle = Position.GetRotation();
		
		return ConstructBuilding(this.GetOwner(), template, angle.y, pos.x, pos.z);
	}
	
	//Spawn template at this entities location.
	definition.Spawn = function(template) {
		let Player = QueryOwnerInterface(this.entity);
		if (!Player)
			return;
		
		let cmpOwnership = Engine.QueryInterface(this.entity, IID_Ownership);
		let Footprint = Engine.QueryInterface(this.entity, IID_Footprint);

		
		let Identity = Engine.QueryInterface(this.entity, IID_Identity);
		
		template = template.replace("{native}", Identity.GetCiv());
		template = template.replace("{civ}", Player.GetCiv());
		
		let ent = Engine.AddEntity(template);
		
		let cmpNewOwnership = Engine.QueryInterface(ent, IID_Ownership);
		
		let pos = Footprint.PickSpawnPoint(ent);
		if (pos.y < 0) {
			rts.Destroy(ent);
			return null; //ENTITY LEAK.. Destroy entity?
		}
		
		let cmpNewPosition = Engine.QueryInterface(ent, IID_Position);
		cmpNewPosition.JumpTo(pos.x, pos.z);
		
		let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
		if (cmpPosition)
			cmpNewPosition.SetYRotation(cmpPosition.GetPosition().horizAngleTo(pos));

		cmpNewOwnership.SetOwner(cmpOwnership.GetOwner());
		
		return ent;
	}
	
	//Build commands.
	if (definition.Commands) for (let command in definition.Commands) {
		let old = g_Commands[command];

		g_Commands[command] = function(player, cmd, data) {
			
			if (old) old(player, cmd, data);
			
			for (let ent of data.entities) {
				let cmp = Engine.QueryInterface(ent, component)
				if (cmp) cmp[definition.Commands[command]](cmd);
			}
		};
	};
	
	//GuiInterface.
	if ("Information" in definition) {
		rts.gui[component] = name;
	}
	
	let Component = function() {};
	Component.prototype = definition;
	
	if (system) {
		Engine.RegisterSystemComponentType(component, name, Component);
	} else {
		Engine.RegisterComponentType(component, name, Component);
	}
}

let Signal = function(ent) {
	this.entity = ent.entity;
	this.component = ent.Component();
	
	let PlayerManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_PlayerManager)

	this.owner = PlayerManager.GetAllPlayers();
}

Signal.prototype.When = function (component) {
	this.when = component;
	return this;
}

Signal.prototype.Within = function(range) {
	this.within = range;
	return this;
}

Signal.prototype.Range = function() {	
	let RangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
	let Component = Engine.QueryInterface(this.entity, this.component)

	if (Component._signal)
		RangeManager.DestroyActiveQuery(Component._signal);

	if (this.within > 0)
	{
		// Only find entities with IID_UnitAI interface
		Component._signal = RangeManager.CreateActiveQuery(this.entity, 0, this.within, this.owner, this.when, RangeManager.GetEntityFlagMask("normal"));
		RangeManager.EnableActiveQuery(Component._signal);
	}
}

//Signals.
rts.Signal = function(ent) {
	return new Signal(ent);
}

rts.Query = function(find) {
	this.find = find;
	this.near = null;
	
	let PlayerManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_PlayerManager)

	this.owner = PlayerManager.GetAllPlayers();
	this.radius = -1;
}

rts.Query.prototype.Near = function(entity) {
	if (entity.entity) {
		this.near = entity.entity;
	} else {
		this.near = entity;
	}
	return this;
}

rts.Query.prototype.Radius = function(radius) {
	this.radius = radius;
	return this;
}

rts.Query.prototype.OwnedBy = function(owner) {
	this.owner = [owner];
	return this;
}

rts.Query.prototype.List = function() {
	let results = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager).ExecuteQuery(this.near, 0, this.radius, this.owner, this.find);
	if (this.find == 0) return results; 
	
	let list = new Array(results.length);
	
	for (let i = 0; i < results.length; i++) {
		list[i] = Engine.QueryInterface(results[i], this.find);
	}
	
	return list;
}

rts.Find = function(component) {
	let Query = new rts.Query(component);
	return Query;
}

rts.Destroy = function(ent) {
	Engine.DestroyEntity(ent);
}

rts.Copy = function(cmp, property, a, b) {
	let A = Engine.QueryInterface(a, cmp);
	let B = Engine.QueryInterface(b, cmp);
	
	if (A && B) {
		B[property] = A[property];
	}
}

Engine.RegisterGlobal("rts", rts);
