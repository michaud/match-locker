# match-locker 

Match-locker is a game where you swipe horizontally and vertically and match slides until you complete the puzzles.

# the editor

The editor provides a visual way to compile the elements of puzzles and games into a game data file <game>.json. 

## the process
- game definition
- Slides in slide groups
- Compose a puzzle from slide groups
  - set the type 
  - set the matches between slides
- Set the visual layout
  - define the puzzle slots

The Editor  is organised to define the Game info and then work from the bottom up. You define a group of slides and add the slides. From the groups of slides, you can compose a puzzle. Composing a puzzle means providing the description, the type of puzzle, how it is evaluated and more. Now you select which slide groups comprise a puzzle. Then you need to specify what the player needs to solve! This means connecting a slide with another slide. That is what the Match editor is for! Select a slide and it gets highlighted, select the next slide and it gets connected to the first slide. Depending on the game type, you can connect several slides to one slide. 
Now you have a puzzle you can set what the visual layout is that will be presented to the player. Puzzle slots is where that happens. By defining a Puzzle slot you set where the swipers of a puzzle overlap. The Layout Visualization displays the results of the puzzle slot settings. 

## games

a game is one or more puzzles

## puzzles
a puzzle consists of two slide groups where the puzzle defines how the puzzle is solved.

there are several puzzle types: set, chain, ring and star which can have an evaluation rule of unordered or ordered. That means you need to make the matches in a specifc order or you can match the slides in any order.

the meaning of the puzzle types:

### set
A set of single matches of two slides

### chain
one slide matched to a second slide. The second slide matched to a third slide and so on.

### ring
one slide matched to a second slide. The second slide matched to a third slide and so on. At some point the last slide is matched to the first slide.

### star
one slide matched to several slides.

## Creating a game

We'll go through a typical game creation.

### game
the top level is the game, it describes what the game is about.

### Slide group and Slides
A basic puzzle comprises of two groups of slides. So you make a slide group and add slides. for the puzzle you need to make a second group and add the slides. And because we want to explain a more complex game, lets add a third slide group with several slides

### Puzzle
We then compose a puzzle, set the title and description of the puzzle which are shown in the @info screen, we set the type of puzzle and how to match the slides: can we match the slides in any order or do we need match the slides in a specific order.

It's important to notice that we can make a puzzle with the first slide group and the second slide group, and then make a second puzzle with the second slide group and the third slide group.

### Matches
Next, with a puzzle defined, in the Match Editor, we can select which two slide groups will need to be matched and define what the matches are. The matches are defined by clicking the first slide of the match to activate it and then clicking the second slide. If the evaluation rule is set to ordered, the order of setting the matches is important. You will see the order marked with the number label.

### Layout with puzzle slots
Until now we have defined all the elements and how they interact. Now that we have puzzles we can define the layout of the puzzles. 

#### puzzle slot
A puzzle slot is a place on two swipers where their slots overlap and where the player can match the slides.
Lets call a slide group in a puzzle in the layout a Swiper. A swiper has the slides of a slide group. Imagine for each slide in the slide group, in the swiper, there is a slot. Slot 1, slot 2, slot 3 ... When the player swipes through the slides, the position of the slides changes in the slots but the slots stay the same position. A puzzle slot is a place on two swipers where their slots overlap and where the player can match the slides.

With the indices you can set the position of where the first swiper overlaps with the second swiper. 

To understand the implications of the index and the guest align index you can play with the numbers and see the result on the Layout Visualisation.

## navigation to puzzles
the player can swipe the slides in the swiper. When they have matched all the slides, they can navigate the slots on the swipers. The default setting is that the player can navigate puzzles on the @info screen. In the settings screen the player can set the visibility of the navigation on the game screen itself for convenience.

- Swipe the slides happens by dragging and flinging. The slides in the swiper animate to a destination and then snap to the center of the viewport.
- Navigating the slots happens with the navigation buttons. Up and down left and right when possible!! When the player navigates to a slot on a swiper that is not a puzzle slot, dependent on the direction of the swiper you can only navigate vertical OR horizontal. If the Swipers overlap making a puzzleslot the player can navigate both horizontally AND vertically. The swiping and navigating are SEPERATE ... BUT ... when we navigate the slots the swiper DOES show the movement of the slides to illustrate the movement over the slots.

# save a game
## save
The app looks for a games.json to fill the list of games. so we need to save the data file that you have created in the editor. On the Live Json output panel there is a save button. That will open a Save as dialog where you can give the file a name and save it to a folder.

## edit
Notice that there is an edit button. This will allow you to actually edit the data in the json file. It also makes it possible to import / paste game data into the Editor. But be aware that there is no validation of the syntax or the data format. So you can edit the file ... but if your changes are not correct, the Editor will not help you.
