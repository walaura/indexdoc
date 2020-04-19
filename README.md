# Preface
This guide is meant as a comprehensive overview of the history and decisions behind the javascript tools powering index, why they are shaped they way they are and where I think they should move towards (spoiler: it's react).

It's intended as a long read overview of the whole architecture for whomever is in charge of leading it in the future. if you are only interested on making component-level changes you might be better served by the readme files linked on our repo.

Before reading this guide you should make yourself familiar with the READMEs for both css and javascript, both also linked from our repo


## Design goals
While our javascript code doesn't base itself on any popular frameworks it does share a lot with the mindset and goals of modern tooling such as React or Vue. It's goals are:

* **Ease of use from within Laravel** Offer behavior as simple pluggable html elements that Laravel can render from templates, avoiding writing extra Javascript glue code  

* **Zero globals** calls to `$()` should be avoided and all DOM operations should be made inside an element (`$element.find()`), keeping code scoped

* **Communication via events** Most application behavior is encapsulated inside discrete elements, which can talk to each other by bubbling events up the DOM tree, then reacting to events on `window`. More on this on the events chapter

* **No class inheritance** Due to the way component based javascript is structured it's not desirable to use class inheritance within components. You can instead use composition, by extracting common behaviors to a `renderable` or an `util`


# Elements
90% of the javascript is constructed around `components`, `triggers`, and `views`. These elements serve different purposes but behave identically from a code standpoint (more on this later) and from now on, for the sake of simplicity, I'll refer to all three of them as `elements`.

Elements are any `<div>` with a specific classname inferred from their name. Think of them as a javascript callback for acting on that window, for example:

	/*traditional jQuery*/
	$('.component_button').css('color','red');

	/*index.co.js*/
	class button extends Component {
		[…]
		apply() {
			this.$element.css('color','red');
		}
	}

This allows you to encapsulate code, by separating the code applied to an element from the one actually selecting those components and keeping their state across page loads. It also greatly improves testability and portability, as the code affecting any element will always stay inside the file named after it.

## Components, Triggers, and Views
The difference between these three elements comes into play when you consider the rest of the HTML and CSS besides Javascript. (You should read our CSS styleguide if you haven't yet)

None of this is enforced on code so you must be extra careful to avoid introducing potential bugs

### Components

	<div class="c_tabbar">
		<div class="c_tabbar-item">Home</div>
		<div class="c_tabbar-item">Visit</div>
	</div>
Components are a defined block of reusable html that can be styled and contain children. The javascript for a component will extend the behavior of this block and can apply styles and select children within. Any given div can only be 1 component at once.

### Triggers

	<div class="c_tabbar-item trigger_vindow trigger_tooltip" title="Go home">Home</div>
A trigger attaches a behavior to any html block, such as opening a modal window on click or adding tooltips on hover. triggers can, by design be stackable, meaning an object can have n triggers.

Triggers shouldn't have css attached as a general rule and should be light in behavior

### Views

	<div class="view_listEditor">
		[…]
	</div>
A view is a complex collection of other elements. As components should be reusable you can use views to define complex behavior interplays where a collection of components wouldn't suffice.

### Actual usage
All three elements will apply their behavior to _any_ HTML element with a class named after it, component is shortened to c for legacy reasons and could benefit from changing it.

	component/button.js
	=> .c_button

	trigger/expandable.js
	=> .trigger_expandable

	view/import.js
	=> .view_import

Elements can also take `parameters` with arbitrary data, these are html data tags prefixes with the full element name with dashes instead of camelcase, for example

	<form class="c_ajaxForm" data-ajax-form-after-submit="reload"></form>  

	class ajaxForm extends Component {
		[…]
		apply() {
			alert(this.parameters.afterSubmit);
		}
	}

## Complex elements
Some elements (especially views) can contain too much behavior and feel cramped on a single file. For those you can use the following structure.

	📁 component
	 🌟 buttonFollow.js (entry)

	📁 component
		📁 buttonFollow
			🌟 buttonFollow.js (entry)
			📄 buttonFollowCounter.js
			📁 data
				📄 states.js
			📁 renderable
				📄 buttonFollow--following.js
				📄 buttonFollow--default.js
A complex element can have any directory structure inside although it's recommendable to use `renderable` elements (inheriting from `framework/primitive/Renderable`) and keep data on a `/data` folder as these are common patterns across our js.

# Events
Elements can use standard jQuery events to talk among each other. Imagine the following construct

	<div class="c_header">
		<div
			class="view_followCounter"
			data-follow-counter-id="826"
		>
			<span>123</span> followers
		</div>
	</div>
	<a
		class="c_uiButton trigger_follow"
		data-follow-id="826"
	>
		Follow
	</a>		

Using events we can entirely decouple these two elements. The follow button could be anywhere else on the page or even on a modal

	/*view/followCounter.js*/
	const $counter = this.$element.find('span');
	$(window).on(config.events.follow,(ev,data) => {
			if(data.id === this.parameters.id) {
					$counter.text($counter.text()+1);
			}
	});

	/*trigger/follow.js*/
	this.$element.on('click', ev => {
			this.$element.trigger(config.events.follow,{
					id: this.parameters.id
			}
	});


## significantDomChange
There's a very special event you must know that keeps this whole system together, it's `significantDomChange`.

Every time you do a, well, significant change on the DOM (to be precise, every time you append new HTML that contains or _may_ contain new js elements) you must do

	$(window).trigger(config.events.significantDomChange)

This lets the watcher (see the Code chapter) pick up the changes and look for new class names. This is intended for large scale ajax content, in general if you want to add elements from javascript it's advisable to turn them into `renderables` instead so you can use a cleaner API.

If you are inside a loop or importing non critical content you should use

	$(window).trigger(config.events.significantDomChangeCanWait)

instead. It works the same as far as you are concerned but it will wait a bit to tell the watcher to rescan the DOM, meaning you can use it lots of times without a performance penalty as it will only run once.

Curious about the inner workings? Check the code reference or dig straight into `framework/service/SignificantDomChange.js` and `framework/Watcher.js`

# The rest of things
Some times you need common behavior, globals or just things that aren't stuck to an html element, that's when the rest of our javascript comes into play

## Renderable
Renderables are a fully featured solution for drawing DOM elements from code based on a set of parameters. Renderables inherit from `framework/primitive/Renderable.js` (some old ones just expose a similar API, but should be rewritten).

Their basic usage goes like this:

	const popup = new Window({
		contents: 'hi there!'
	});
	popup.place();

You can easily convert most elements into renderables if you ever feel like you'll need them somewhere else too. This is our preferred alternative to doing class inheritance.

## Util
Contains classes on the root directory and tiny js helper functions on `/js` that help do various things, this place is a bit of a grab bag and could be organized better but don't really bother unless it ever reaches 15 files total.

## Service
Services are classes that get loaded on every pageload and do global things. You should _not_ include them from other code parts but you can make a service call an util, then call the same util from elsewhere.

Services are useful, for example, for listening to global events throw by elements and dispatching success or failure events

## Framework
This directory contains the core files needed for everything else to run. Ideally you could delete everything but `app.js` and `/framework` and have an errorless compilation, even if the code itself would do nothing.

As of today this is not possible due to the location of `util/js/dom` which could and should be moved.

### Services
`framework/services` acts as the normal `/services` directory and all classes there will be autoloaded, the only difference is that framework-wide services not related to index itself should go there for organization purposes

### Primitive
Abstract class definitions

### Data
Globals that aren't meant to be changed

### Loader
Autoloaders for elements, classes, etc. More on this on the Code Overview and Build chapters

# Code overview
The chapter from before covers _why_ things are happening the way they are, now let's get into what is actually happening, shall we?

It is strongly encouraged that you spend a couple minutes following the code paths yourself, it's about 10 files total and they are very self-explaining. On any case please keep the files close for this chapter as I will be describing them in detail.

## Entry
The entry point for the application is `app.js` (shocking, i know right) which by itself just loads the `AutoServiceLoader` and `ElementLoader`.

As we discussed earlier, services are loaded on their own so that name makes sense! In fact, if you open the `AutoServiceLoader` you'll see it's literally a list of classes that get loaded (And an autobuilt warning, more on that on the build chapter!)

`ElementLoader` is not much better, just making `Watcher` objects from a list of elements. As well as loading `importToChunk` which we'll also discuss on the build chapter.

All these files are either artifacts from the build system or mere glue between said artifacts so we'll come back at them later, let's begin with the FUN

## Config
`config.js` houses some configuration parameters that the rest of elements can access at any time. Some of these parameters are being sent from laravel as a js object on `views/header.php`.

## Watcher
A Watcher ensures every html element on the actual page gets actually acted on by their js element. It does this by iterating over the DOM on every page load as well as every time it receives a `significantDomChange` event.

Once it finds a html element it just sends it over to the actual js file you wrote (for example `view/editorCompany.js`)

## Elements & AbstractElement
Elements inherit from `primitive/Component.js`, `primitive/Trigger.js`, or `primitive/View.js` which in turn inherit from `primitive/AbstractElement.js`. Open both `AbstractElement` and another primitive of your choice to see how little actual change there is.

You aren't supposed to override the constructor on elements as it does very ugly code initialization. You can see how it basically parses the html tag with the help of `framework/DomElement` and sends this to `apply()` giving you the parameters and the element already loaded on `this.*`

`apply()` should be considered the actual constructor you get to override.

### Parts of an element
To not break at compile time element must have at least a `selector` and a matching class name. Due to the way javascript works the class name doesn't even matter so you can disable the strict checking here with zero consequences.

#### get selector()

	export default class UiButtonModifierFollowComponent extends Component {

	    static get selector() {
	        return 'uiButton--follow';
	    }

	    apply() {}  

	}

* selector() is the actual css selector sans prefix and must match the file name
* the class name must match the selector except it uses full CamelCase and replaces `-` with `Sub` and `--` with `Modifier`

#### get defaultParameters()
Returns an object of parameters that will be assigned by default  on `this.parameters` if all of some of them are missing

#### get async()
Defines if the element will load asynchronously or not. What this means on a nutshell is that loaded javascript elements get a `{classname}--ready` css class attached to them, which you can use to toggle their visibility or display a wait cursor or whatever.

By default elements get this class as soon as their js loads (as seen on `AbstractElement`, if you specify them as async they will wait for you to call `this.ready()`.

	export default class RemoteTextComponent extends Component {

	    static get async() {
	        return true;
	    }

	    apply() {
		    fetch(this.parameters.endpoint)
			    .then(response => response.text)
			    .then(text => {
				    this.$element.text(text);
				    this.ready();
			    })
	    }  

	}


	/*css*/
	.c_remoteText {
		display:none;
		&--ready {
			display: block;
		}
	}

#### apply()
Apply is where all the code happens. As you have already seen you can use `this.$element` to access the element, as well as `this.parameters` to access the parameters. Your code runs here which is the important part really.

## framework/DomElement
I kind of glossed over this one before, didn't I?

This is where we dive deep into legacy and low-level code territory. DomElement is a layer over jQuery's basic `$` objects that adds useful tools relevant to index.

Most of them are self explanatory but here is also where the magic of _parameter fetching_ is happening. This is the process where the `data-` tags (and more!) get turned into parameters.

To learn how this works however we have to go one level deeper. Bet you were curious about that `util/js/dom` linked from all files, right?

## util/js/dom
This is an abstraction layer over the entirety of jQuery. Most of it is bad as it extends some global javascript objects such as String and is not doing any caching of the jQuery plugins defined inside.

Ideally you want to look into refactoring this file so it just returns a copy of jQuery with the plugins loaded inside and does so ONCE instead of every time, also move the getting parameters part out from here and into `framework/DomElement`.

I suggest you grep most of these functions to see them in use as i don't advocate for keeping any of them as jQuery plugins and would rather see them refactored into framework-agnostic utils. here's a couple concepts of interest tho

### getParams
This gets the parameters!! it will scan for `data-`tags on the HTML but **ALSO** in the css, letting you send over breakpoints. You can grep `--params` to see this in action. it should be refactored into `DomElement`

### findTarget
This is a nifty useful tool used mostly on `trigger_popover` and similar items. These triggers allow you to specify their contents as a html selector and to avoid globals you can use a syntax with css-like selectors. It should become an util.

	<li
		class="c_header-notificationIcon trigger_popover"
		data-popover-style="white"
		data-popover-fixed="true"
		data-popover-target="& .trigger_tooltip-target"
	>
		Notifications
		<script
			type="text/ng-template"
			class="trigger_tooltip-target"
		>
			Notification menu
		</script>
	</li>

	const $target = this.$element.findTarget(this.parameters.target);

## util/ClassName
Lets you programmatically define class names

	$item.append(`
	    <div class="${new ClassName('component',['tabbar','item','sub','sub']).get()}">
	        ${mission.subtext}
	    </div>
	`)

Classname accepts three arguments, `type`, `name`, and `modifier`. type is one of the common element types mentioned across this document, name can be an array of elements for children, and modifier is optional and will apply one or more modifiers to the final classname

	('component','header')
	=> .c_header

	('component',['header','search'])
	=> .c_header-search

	('component',['header','search'],'active')
	=> .c_header-search--active

You can use `.get()` to get a full classname or `.getSelector()` to get the css selector (it's the name but with a period before it) for jQuery selectors

## util/auth
Checks if an user is authenticated using promises. This is unsafe as it's checked entirely on the frontend and thus modifiable using dev tools so it should only be used to prompt for login and whatnot.

# Build system
Oh boy here we go.

We are using grunt right now. You can type `grunt help` for a quick overview of what you can do as a user but you should already know those.

If you take a quick look at `gruntfile.js` you'll see that we are using industry standard tools such as webpack and babel, these are the most complex parts and luckily they are widely documented. I'm gonna go over our webpack config later on in any case.

There's also a collection of scripts `build/tasks` that aren't tied to grunt in any way but run from it. These are the ones building most of the autogenerated files you can see on `js/framework` and while they are a bit spaghetti-ish they can be easily refactored since they aren't coupled with anything, they just have to produce the same output as before

## Scripts

### Clean
This just cleans up a list of directories. To avoid temporary filed building up over time.

### populateLoader
This builds up `AutoServiceLoader.js` and `elementList.json`, both or which are later used by index.co.js to load elements and services. it mostly scans a lot of folders, grabs a lot of metadata from filenames and outputs what it finds.

As stated earlier, elements can live in either `{element}/{elementName}.js` or `{element}/{elementName}/{elementName}.js`. This along with the fact that the initial directories can be a subdirectory `framework/service` add up a lot of code complexity here. it's still carrying a lot of legacy baggage and can easily be trimmed down and made more readable.

### makePopularElementList
This runs only when demanded and will scan `index.co` (the real one) as well as your dev site (provided you have a fully qualified `APP_BASE_URL_AUTHENTICATED` variable with login data on your .ENV) for the most used elements. These will then be loaded earlier on the build process which results in leaner page loads.

### makeLessImportList
this makes the base less file that then includes all the components on `resources/less` as well as the overrides on `resources/less/override`

## Grunt tasks
by nature of grunt the files go through a mind boggling number of places and transformations before reaching their target. There's no easy explanation for this one, just read up on `gruntfile.js`, `build/grunt/config/*` and `build/config.js` and try to keep up!

In general however files try to go to `build/temp` before they are finally moved to `public/build`. This is not entirely true as it's influenced by some of the inner workings of Webpack for example, which doesn't work nicely with grunt's file operations.

### csso
optimizes the resulting css

### less
converts .less files to .css files, adds browser prefixes and applies the overrides defined by `makeLessImportList`

### uglify
uglifies the final js code. This should be refactored inside webpack tbh since they are probably doing redundant work

### webpack
This is the file for webpack and babel configuration. Webpack and babel take our modern, cool, scoped, free of globals, javascript and turn it into normal javascript browsers can use.

You can learn more on webpack at https://webpack.js.org

This should be refactored to use webpack as a cli tool rather than as a grunt dependency, since webpack can handle transforming all the javascript instead of having 3 separate tools for it
