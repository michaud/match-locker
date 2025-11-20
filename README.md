# match-locker 

Match-locker is a game where you swipe to match slides until you complete the puzzle.
you can have several puzzles in a game. 

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

## game editor
to compose the puzzles and games we use the game editor.

### game
the top level is the game, it describes what the game is about.

### Slide group and Slides
A basic puzzle comprises of two groups of slides. So we make a slide group and add slides. for the puzzle we make a second group and add the slides. To explain the next levels we are going to make a third slide group and add slides.

### Puzzle
We then define a puzzle, set the title and description of the puzzle which are shown in the puzzle, we set the type of puzzle and how to match the slides: can we match the slides in any order or do we need match the slides in a specific order.

it's important to notice that we can make a puzzle with the first slide group and the second slide group, and then make a second puzzle with the second slide group and the third slide group.

### Matches
Next, with a puzzle defined, in the Match Editor, we can select which two slide groups will need to be matched and define what the matches are. The matches are defined by clicking the first slide of the match to activate it and then clicking the second slide. If the evaluation rule is set to ordered, the order of setting the matches is important. You will see the order marked with the number label.

### Layout with puzzle slots
Until now we have defined all the elements and how they interact. Now that we have puzzles we can define the layout of the puzzles but also of the game! 

#### puzzle slot
A puzzle slot is a place on two swipers where their slots overlap and where we can match the slides.
Lets call a slide group in a puzzle in the layout a swiper. A swiper has the slides of a slide group. Imagine for each slide in the slide group, in the swiper, we have a slot. Slot 1, slot 2, slot 3 ... When we swipe through the slides, the position of the slides changes in the slots but the slots stay the same. A puzzle slot is a place on two swipers where their slots overlap and where we can match the slides.

With the indices We can set the position of where first swiper overlaps with the second swiper. 

To understand the implications of the index and the guest align index you can play with the numbers and see the result on the Layout Visualisation

