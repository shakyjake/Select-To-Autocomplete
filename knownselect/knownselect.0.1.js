/*
	Changes select to autocomplete
	
	- Use this only if the user absolutely knows what they're looking for in a select element
	
	2018-10-01 Jake Nicholson (www.eskdale.net)
	
	This is free and unencumbered software released into the public domain.

	Anyone is free to copy, modify, publish, use, compile, sell, or
	distribute this software, either in source code form or as a compiled
	binary, for any purpose, commercial or non-commercial, and by any
	means.
	
	In jurisdictions that recognize copyright laws, the author or authors
	of this software dedicate any and all copyright interest in the
	software to the public domain. We make this dedication for the benefit
	of the public at large and to the detriment of our heirs and
	successors. We intend this dedication to be an overt act of
	relinquishment in perpetuity of all present and future rights to this
	software under copyright law.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
	EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
	IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
	OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
	ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
	OTHER DEALINGS IN THE SOFTWARE.
	
	For more information, please refer to <http://unlicense.org/>
*/
var KnownSelect;
KnownSelect = function(Selector, OptionsToShow){
	
	var _ = this;
	
	_.OptionsToShow = typeof(OptionsToShow) === 'undefined' ? 5 : OptionsToShow;
	
	_.InputValue = function(Input){/* Retrieves input values, works for select too. */
		var Value = '';
		if(Input.nodeName.toLowerCase() === 'select'){
			if(typeof(Input.selectedOptions) === 'undefined'){
				var Options, i;
				Options = Input.children;
				i = Options.length;
				while(!!i){
					i -= 1;
					if(Options[i].selected){
						Value = Options[i].selected;
						i = 0;/* exit loop */
					}
				}
			} else {
				if(Input.selectedOptions.length){
					Value = Input.selectedOptions[0].value;
				}
			}
		} else {
			Value = Input.value;
		}
		return Value;
	};
	
	_.SelectJSON = function(Select){/* Takes options and turns them into a nice, javascriptable object (it's not technically JSON but w/e) */
		var Result, Options, i, ii, Also;
		Result = [];
		Options = Select.querySelectorAll('option');
		i = 0;
		ii = Options.length;
		while(i < ii){
			if(!Options[i].disabled){
				if(!!Options[i].value.length){
					Also = [];
					if(!!Options[i].getAttribute('data-synonyms')){/* allow searching of additional terms with a "synonyms" data attribute */
						Also = Options[i].getAttribute('data-synonyms').split(',');
					}
					Result.push({
						"Text" : Options[i].textContent,
						"Value" : Options[i].value,
						"Also" : Also
					});
				}
			}
			i += 1;
		}
		return Result;
	};
	
	_.Each = function(Arr, CallBack){/* Simple polyfill for forEach */
		var i = Arr.length;
		while(!!i){
			i -= 1;
			CallBack(Arr[i]);
		}
	};
	
	_.Search = function(Arr, Term){
		var Results, Result, Relevance, RE;
		Results = [];
		
		_.Each(Arr, function(Option){/* Loops through options, assigning each a relevance score */
			
			Relevance = 0;
			
			RE = new RegExp('^' + Term + '$', 'gi');
			if(RE.test(Option.Value)){
				Relevance += 1000;
			}
			if(RE.test(Option.Text)){
				Relevance += 500;
			}
			_.Each(Option.Also, function(Syn){
				if(RE.test(Syn)){
					Relevance += 50;
				}
			});
			
			RE = new RegExp('^' + Term, 'gi');
			if(RE.test(Option.Text)){
				Relevance += 250;
			}
			_.Each(Option.Also, function(Syn){
				if(RE.test(Syn)){
					Relevance += 25;
				}
			});
			
			RE = new RegExp('(^|\\s)' + Term + '($|\\s)', 'gi');
			if(RE.test(Option.Text)){
				Relevance += 100;
			}
			_.Each(Option.Also, function(Syn){
				if(RE.test(Syn)){
					Relevance += 10;
				}
			});
			
			RE = new RegExp('.*' + Term + '.*', 'gi');
			if(RE.test(Option.Text)){
				Relevance += 60;
			}
			_.Each(Option.Also, function(Syn){
				if(RE.test(Syn)){
					Relevance += 1;
				}
			});
			
			if(!!Relevance){
				Result = Option;
				Result.Relevance = Relevance;
				Results.push(Result);
			}
		
		});
		return Results.sort(function(a,b){/* Sort by relevance, then alphabetically */
			if(b.Relevance > a.Relevance){
				return 1;
			}
			if(b.Relevance < a.Relevance){
				return -1;
			}
			if(a.Text > b.Text){
				return 1;
			}
			if(a.Text < b.Text){
				return -1;
			}
			return 0;
		});
	};
	
	_.SetupAutocomplete = function(Select){
		
		var __ = this;
		
		__.Select = Select;
		
		__.Values = _.SelectJSON(__.Select);
		
		__.InitValue = _.InputValue(__.Select);
		
		__.TextInput = null;
		__.HiddenInput = null;
		__.AutoCompleteHolder = null;
		
		__.Cheerio = function(){/* Hides the options */
			__.AutoCompleteHolder.className = 'select-autocomplete hidden';
		};
		
		__.OptionChosen = function(event){/* Button has been clicked. Thank the user by removing the buttons they no longer need. */
			var Button, Value;
			Button = event.target;
			Value = Button.getAttribute('data-value');
			__.HiddenInput.value = Value;
			__.TextInput.value = Button.textContent;
			__.Cheerio();
		};
		
		__.AddAutoCompleteOption = function(Text, Value){/* Renders autocomplete button */
			
			var Option;
			Option = document.createElement('button');
			Option.type = 'button';
			Option.innerHTML = Text;
			Option.setAttribute('data-value', Value);
			Option.addEventListener('click', __.OptionChosen);
			Option.addEventListener('tap', __.OptionChosen);
			__.AutoCompleteHolder.appendChild(Option);
		};
		
		__.TextChanged = function(){
			
			if(!!_.InputValue(__.TextInput).length){
				
				var Results, i, ii;
				Results = _.Search(__.Values, _.InputValue(__.TextInput));
				
				if(!!Results.length){/* only clear results if we've got something to show for it (compounded errors should not be punished with a lack of recovery options) */
				
					while(!!__.AutoCompleteHolder.childNodes.length){
						__.AutoCompleteHolder.removeChild(__.AutoCompleteHolder.childNodes[0]);
					}
				
					if(Results.length === 1){/* We've only got one result - use it. (But don't confuse user by changing their input (and still give them the option of clicking button to hide options)) */
						__.HiddenInput.value = Results[0].Value;
					}
					i = 0;
					ii = _.OptionsToShow;
					ii = Math.min(ii, Results.length);
					while(i < ii){
						__.AddAutoCompleteOption(Results[i].Text, Results[i].Value);
						i += 1;
					}
				}
				__.AutoCompleteHolder.className = 'select-autocomplete';
				
			} else {/* User has emptied the input - no more suggestions for you, lovely user */
				__.Cheerio();
			}
		};
		
		__.ReplaceSelect = function(){
			
			__.HiddenInput = document.createElement('input');
			__.HiddenInput.name = __.Select.name;
			__.HiddenInput.id = __.Select.id + '_Hidden';
			__.HiddenInput.value = __.InitValue;
			__.HiddenInput.type = 'hidden';
			
			__.TextInput = document.createElement('input');
			__.TextInput.name = __.Select.name + '_Text';
			__.TextInput.id = __.Select.id;
			if(!!__.InitValue.length){
				__.TextInput.value = __.Select.querySelector('option[value="' + __.InitValue + '"]').textContent;
			}
			__.TextInput.type = 'text';
			
			__.TextInput.addEventListener('keyup', __.TextChanged);/* Ideally we'd use the "input" event but IE9 doesn't support it and Firefox is broken in ways too complex to describe in an off-the-cuff JS comment */
			
			__.AutoCompleteHolder = document.createElement('span');
			__.AutoCompleteHolder.className = 'select-autocomplete hidden';
			
			__.Select.parentNode.replaceChild(__.TextInput, __.Select);
			__.TextInput.parentNode.insertBefore(__.HiddenInput, __.TextInput.nextSibling);
			__.HiddenInput.parentNode.insertBefore(__.AutoCompleteHolder, __.HiddenInput.nextSibling);
			
		};
		
		__.ReplaceSelect();
		
	};
	
	_.Init = function(){
		
		var Inputs = document.querySelectorAll(Selector);
		var i = Inputs.length;
		
		while(!!i){
			i -= 1;
			_.SetupAutocomplete(Inputs[i]);
		}
		
	};
	
	_.Init();
	
};