interface DropdownOption {
	readonly name: string;
	readonly value: string;
	readonly hint?: string;
	readonly group?: string;
}

/**
 * Implements the dropdown inputs used in the Git Graph View's top control bar.
 */
class Dropdown {
	private readonly showInfo: boolean;
	private readonly multipleAllowed: boolean;
	private readonly selectMultipleWithCtrl: boolean;
	private readonly changeCallback: (values: string[]) => void;
	private readonly filterSubmitCallback: ((value: string) => void) | null;

	private options: ReadonlyArray<DropdownOption> = [];
	private optionsSelected: boolean[] = [];
	private lastSelected: number = 0; // Only used when multipleAllowed === false
	private dropdownVisible: boolean = false;
	private focussedOption: number = -1;
	private lastClicked: number = 0;
	private doubleClickTimeout: NodeJS.Timeout | null = null;

	private readonly elem: HTMLElement;
	private readonly currentValueElem: HTMLDivElement;
	private readonly menuElem: HTMLDivElement;
	private readonly optionsElem: HTMLDivElement;
	private readonly noResultsElem: HTMLDivElement;
	private readonly filterInput: HTMLInputElement;

	/**
	 * Constructs a Dropdown instance.
	 * @param id The ID of the HTML Element that the dropdown should be rendered in.
	 * @param showInfo Should an information icon be shown on the right of each dropdown item.
	 * @param multipleAllowed Can multiple items be selected.
	 * @param dropdownType The type of content the dropdown is being used for.
	 * @param changeCallback A callback to be invoked when the selected item(s) of the dropdown changes.
	 * @returns The Dropdown instance.
	 * @param selectMultipleWithCtrl Select multiple items using Ctrl
	 * @param filterSubmitCallback Optional callback invoked when Enter is pressed in the filter input with non-empty text.
	 */
	constructor(id: string, showInfo: boolean, multipleAllowed: boolean, dropdownType: string, changeCallback: (values: string[]) => void, selectMultipleWithCtrl: boolean = false, filterSubmitCallback: ((value: string) => void) | null = null) {
		this.showInfo = showInfo;
		this.multipleAllowed = multipleAllowed;
		this.selectMultipleWithCtrl = selectMultipleWithCtrl;
		this.changeCallback = changeCallback;
		this.filterSubmitCallback = filterSubmitCallback;
		this.elem = document.getElementById(id)!;

		this.menuElem = document.createElement('div');
		this.menuElem.className = 'dropdownMenu';
		this.menuElem.setAttribute('role', 'listbox');

		let filter = this.menuElem.appendChild(document.createElement('div'));
		filter.className = 'dropdownFilter';

		this.filterInput = filter.appendChild(document.createElement('input'));
		this.filterInput.className = 'dropdownFilterInput';
		this.filterInput.placeholder = getText('ui.filter') + ' ' + dropdownType + '...';

		this.optionsElem = this.menuElem.appendChild(document.createElement('div'));
		this.optionsElem.className = 'dropdownOptions';

		this.noResultsElem = this.menuElem.appendChild(document.createElement('div'));
		this.noResultsElem.className = 'dropdownNoResults';
		this.noResultsElem.innerHTML = getText('ui.noResults');

		this.currentValueElem = this.elem.appendChild(document.createElement('div'));
		this.currentValueElem.className = 'dropdownCurrentValue';
		this.currentValueElem.tabIndex = 0;
		this.currentValueElem.setAttribute('role', 'button');
		this.currentValueElem.setAttribute('aria-haspopup', 'listbox');
		this.currentValueElem.setAttribute('aria-expanded', 'false');

		alterClass(this.elem, 'multi', multipleAllowed && !selectMultipleWithCtrl);
		this.elem.appendChild(this.menuElem);

		document.addEventListener('click', (e) => {
			if (!e.target) return;
			const target = <HTMLElement>e.target;
			if (target === this.currentValueElem || target.closest('.dropdownCurrentValue') === this.currentValueElem) {
				if (this.dropdownVisible) {
					this.close();
				} else {
					this.open();
				}
			} else if (this.dropdownVisible) {
				if (target.closest('.dropdown') !== this.elem) {
					this.close();
				} else {
					const option = <HTMLElement | null>target.closest('.dropdownOption');
					if (option !== null && option.parentNode === this.optionsElem && typeof option.dataset.id !== 'undefined') {
						this.onOptionClick(parseInt(option.dataset.id!), e);
					}
				}
			}
		}, true);
		document.addEventListener('contextmenu', () => this.close(), true);
		this.optionsElem.addEventListener('mousemove', (e) => {
			if (!e.target) return;
			const option = <HTMLElement | null>(<HTMLElement>e.target).closest('.dropdownOption');
			if (option !== null && option.parentNode === this.optionsElem && typeof option.dataset.id !== 'undefined') {
				this.setFocussedOption(parseInt(option.dataset.id!), false);
			}
		});
		this.currentValueElem.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
				this.open();
				handledEvent(e);
			} else if (e.key === 'Escape' && this.dropdownVisible) {
				this.close();
				handledEvent(e);
			}
		});
		this.filterInput.addEventListener('input', () => this.filter());
		this.filterInput.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowDown') {
				this.moveFocus(1);
				handledEvent(e);
			} else if (e.key === 'ArrowUp') {
				this.moveFocus(-1);
				handledEvent(e);
			} else if (e.key === 'Home') {
				this.focusEdgeOption(1);
				handledEvent(e);
			} else if (e.key === 'End') {
				this.focusEdgeOption(-1);
				handledEvent(e);
			} else if (e.key === 'Escape') {
				this.close();
				this.currentValueElem.focus();
				handledEvent(e);
			} else if (e.key === 'Enter') {
				const value = this.filterInput.value.trim();
				if (this.filterSubmitCallback !== null && value !== '' && !this.hasExactVisibleOption(value)) {
					this.close();
					this.filterSubmitCallback(value);
					handledEvent(e);
				} else if (this.focussedOption > -1 && this.isOptionVisible(this.focussedOption)) {
					this.onOptionClick(this.focussedOption, e);
					handledEvent(e);
				}
			}
		});
	}

	/**
	 * Set the options that should be displayed in the dropdown.
	 * @param options An array of the options to display in the dropdown.
	 * @param optionsSelected An array of the selected options in the dropdown.
	 */
	public setOptions(options: ReadonlyArray<DropdownOption>, optionsSelected: string[] | null) {
		this.options = options;
		this.optionsSelected = [];
		let selectedOption = -1, isSelected;
		if (optionsSelected) {
			for (let i = 0; i < options.length; i++) {
				isSelected = optionsSelected.includes(options[i].value);
				this.optionsSelected[i] = isSelected;
				if (isSelected) {
					selectedOption = i;
				}
			}
		}
		if (selectedOption === -1) {
			selectedOption = 0;
			this.optionsSelected[selectedOption] = true;
		}
		this.lastSelected = selectedOption;
		if (this.dropdownVisible && options.length <= 1) this.close();
		this.render();
		this.clearDoubleClickTimeout();
	}

	/**
	 * Is a value selected in the dropdown (respecting "Show All")
	 * @param value The value to check.
	 * @returns TRUE => The value is selected, FALSE => The value is not selected.
	 */
	public isSelected(value: string) {
		if (this.options.length > 0) {
			if (this.multipleAllowed && this.optionsSelected[0]) {
				// Multiple options can be selected, and "Show All" is selected.
				return true;
			}
			const optionIndex = this.options.findIndex((option) => option.value === value);
			if (optionIndex > -1 && this.optionsSelected[optionIndex]) {
				// The specific option is selected
				return true;
			}
		}
		return false;
	}

	/**
	 * Is Show All selected in the dropdown
	 * @returns TRUE => Show All is selected, FALSE => Show All is not selected
	 */
	public isShowAllSelected() {
		return this.optionsSelected[0];
	}

	/**
	 * Select a specific value in the dropdown.
	 * @param value The value to select.
	 */
	public selectOption(value: string, event: MouseEvent | undefined) {
		const optionIndex = this.options.findIndex((option) => value === option.value);
		if (optionIndex < 0 || (!this.optionsSelected[0] && this.optionsSelected[optionIndex])) return;
		if (this.multipleAllowed && !this.optionsSelected[0] && (!this.selectMultipleWithCtrl || (event && (event.ctrlKey || event.metaKey)))) {
			// Select the option with the specified value
			this.optionsSelected[optionIndex] = true;
		} else {
			for (let i = 0; i < this.optionsSelected.length; i++) {
				this.optionsSelected[i] = false;
			}
			this.optionsSelected[optionIndex] = true;
		}
		// A change has occurred, re-render the dropdown options
		const menuScroll = this.menuElem.scrollTop;
		this.render();
		if (this.dropdownVisible) {
			this.menuElem.scroll(0, menuScroll);
		}
		this.changeCallback(this.getSelectedOptions(false));
	}

	/**
	 * Unselect a specific value in the dropdown.
	 * @param value The value to unselect.
	 */
	public unselectOption(value: string) {
		const optionIndex = this.options.findIndex((option) => value === option.value);
		if (optionIndex < 0 || (!this.optionsSelected[0] && !this.optionsSelected[optionIndex])) return;
		if (this.multipleAllowed) {
			if (this.optionsSelected[0]) {
				// Show All is currently selected, so unselect it, and select all branch options
				this.optionsSelected[0] = false;
				for (let i = 1; i < this.optionsSelected.length; i++) {
					this.optionsSelected[i] = true;
				}
			}

			// Unselect the option with the specified value
			this.optionsSelected[optionIndex] = false;
			if (this.optionsSelected.every(selected => !selected)) {
				// All items have been unselected, select "Show All"
				this.optionsSelected[0] = true;
			}

			// A change has occurred, re-render the dropdown options
			const menuScroll = this.menuElem.scrollTop;
			this.render();
			if (this.dropdownVisible) {
				this.menuElem.scroll(0, menuScroll);
			}
			this.changeCallback(this.getSelectedOptions(false));
		}
	}

	/**
	 * Refresh the rendered dropdown to apply style changes.
	 */
	public refresh() {
		if (this.options.length > 0) this.render();
	}

	/**
	 * Is the dropdown currently open (i.e. is the list of options visible).
	 * @returns TRUE => The dropdown is open, FALSE => The dropdown is not open
	 */
	public isOpen() {
		return this.dropdownVisible;
	}

	/**
	 * Close the dropdown.
	 */
	public close() {
		this.elem.classList.remove('dropdownOpen');
		this.currentValueElem.setAttribute('aria-expanded', 'false');
		this.dropdownVisible = false;
		this.setFocussedOption(-1, false);
		this.clearDoubleClickTimeout();
	}

	/**
	 * Open the dropdown.
	 */
	private open() {
		this.dropdownVisible = true;
		this.elem.classList.add('dropdownOpen');
		this.currentValueElem.setAttribute('aria-expanded', 'true');
		this.filterInput.value = '';
		this.filter(true);
		this.filterInput.focus();
	}

	/**
	 * Render the dropdown.
	 */
	private render() {
		this.elem.classList.add('loaded');

		const curValueText = formatCommaSeparatedList(this.getSelectedOptions(true));
		this.currentValueElem.title = curValueText;
		this.currentValueElem.innerHTML = escapeHtml(curValueText);

		let html = '';
		for (let i = 0; i < this.options.length; i++) {
			const escapedName = escapeHtml(this.options[i].name);
			const selected = this.optionsSelected[i];
			html += '<div class="dropdownOption' + this.getOptionGroupClass(this.options[i]) + (selected ? ' ' + CLASS_SELECTED : '') + '" data-id="' + i + '" title="' + escapedName + '" role="option" aria-selected="' + selected + '">' +
				(this.multipleAllowed && !this.selectMultipleWithCtrl ? '<div class="dropdownOptionMultiSelected">' + (selected ? SVG_ICONS.check : '') + '</div>' : '') +
				escapedName + (typeof this.options[i].hint === 'string' && this.options[i].hint !== '' ? '<span class="dropdownOptionHint">' + escapeHtml(this.options[i].hint!) + '</span>' : '') +
				(this.showInfo ? '<div class="dropdownOptionInfo" title="' + escapeHtml(this.options[i].value) + '">' + SVG_ICONS.info + '</div>' : '') +
				'</div>';
		}
		this.optionsElem.className = 'dropdownOptions' + (this.showInfo ? ' showInfo' : '');
		this.optionsElem.innerHTML = html;
		this.filterInput.style.display = 'none';
		this.noResultsElem.style.display = 'none';
		this.menuElem.style.cssText = 'left:0; overflow-y:auto;';
		if (this.dropdownVisible) this.filter();
	}

	/**
	 * Filter the options displayed in the dropdown list, based on the filter criteria specified by the user.
	 * @param preferSelected TRUE => Focus the first selected matching option, FALSE => Keep the current focussed option if possible.
	 */
	private filter(preferSelected: boolean = false) {
		let val = this.filterInput.value.toLowerCase(), match, matches = false, firstMatch = -1, firstSelectedMatch = -1;
		for (let i = 0; i < this.options.length; i++) {
			match = this.options[i].name.toLowerCase().indexOf(val) > -1 ||
				this.options[i].value.toLowerCase().indexOf(val) > -1 ||
				(typeof this.options[i].hint === 'string' && this.options[i].hint!.toLowerCase().indexOf(val) > -1);
			(<HTMLElement>this.optionsElem.children[i]).style.display = match ? 'block' : 'none';
			if (match) {
				matches = true;
				if (firstMatch === -1) firstMatch = i;
				if (firstSelectedMatch === -1 && this.optionsSelected[i]) firstSelectedMatch = i;
			}
		}
		this.filterInput.style.display = 'block';
		this.noResultsElem.style.display = matches ? 'none' : 'block';
		this.updateGroupedOptionRows();
		this.setFocussedOption(preferSelected && firstSelectedMatch > -1
			? firstSelectedMatch
			: this.isOptionVisible(this.focussedOption) ? this.focussedOption : firstMatch);
		this.positionMenu();
	}

	/**
	 * Get an array of the selected dropdown options.
	 * @param names TRUE => Return the names of the selected options, FALSE => Return the values of the selected options.
	 * @returns The array of the selected options.
	 */
	private getSelectedOptions(names: boolean) {
		let selected = [];
		if (this.multipleAllowed && this.optionsSelected[0]) {
			// Note: Show All is always the first option (0 index) when multiple selected items are allowed
			return [names ? this.options[0].name : this.options[0].value];
		}
		for (let i = 0; i < this.options.length; i++) {
			if (this.optionsSelected[i]) selected.push(names ? this.options[i].name : this.options[i].value);
		}
		return selected;
	}

	/**
	 * Get the CSS class corresponding to a dropdown option group.
	 * @param option The option to classify.
	 * @returns The CSS class for the option group.
	 */
	private getOptionGroupClass(option: DropdownOption) {
		if (option.group === 'localBranch') return ' dropdownOptionLocalBranch';
		if (option.group === 'remoteBranch') return ' dropdownOptionRemoteBranch';
		if (option.group === 'branchMeta') return ' dropdownOptionBranchMeta';
		return '';
	}

	/**
	 * Select a dropdown option.
	 * @param option The index of the option to select.
	 */
	private onOptionClick(option: number, event?: MouseEvent | KeyboardEvent) {
		// Note: Show All is always the first option (0 index) when multiple selected items are allowed
		let change = false;
		let doubleClick = this.doubleClickTimeout !== null && this.lastClicked === option;
		if (this.doubleClickTimeout !== null) this.clearDoubleClickTimeout();
		if (doubleClick) {
			// Double click
			if (this.multipleAllowed && option === 0) {
				for (let i = 1; i < this.optionsSelected.length; i++) {
					this.optionsSelected[i] = !this.optionsSelected[i];
				}
				change = true;
			}
		} else {
			// Single Click
			if (this.multipleAllowed && (!this.selectMultipleWithCtrl || (event && (event.ctrlKey || event.metaKey)))) {
				// Multiple dropdown options can be selected
				if (option === 0) {
					// Show All was selected
					if (!this.optionsSelected[0]) {
						this.optionsSelected[0] = true;
						for (let i = 1; i < this.optionsSelected.length; i++) {
							this.optionsSelected[i] = false;
						}
						change = true;
					}
				} else {
					if (this.optionsSelected[0]) {
						// Deselect "Show All" if it is enabled
						this.optionsSelected[0] = false;
					}

					this.optionsSelected[option] = !this.optionsSelected[option];

					if (this.optionsSelected.every(selected => !selected)) {
						// All items have been unselected, select "Show All"
						this.optionsSelected[0] = true;
					}
					change = true;
				}
			} else {
				// Only a single dropdown option can be selected
				this.close();
				if (option === 0) {
					// Show All was selected
					if (!this.optionsSelected[0]) {
						this.optionsSelected[0] = true;
						for (let i = 1; i < this.optionsSelected.length; i++) {
							this.optionsSelected[i] = false;
						}
						change = true;
					}
				} else if (this.lastSelected !== option) {
					for (let i = 0; i < this.optionsSelected.length; i++) {
						this.optionsSelected[i] = false;
					}
					this.optionsSelected[this.lastSelected] = false;
					this.optionsSelected[option] = true;
					change = true;
				}
			}

			if (change) {
				this.lastSelected = option;
				// If a change has occurred, trigger the callback
				this.changeCallback(this.getSelectedOptions(false));
			}
		}

		if (change) {
			// If a change has occurred, re-render the dropdown elements
			let menuScroll = this.menuElem.scrollTop;
			this.render();
			if (this.dropdownVisible) this.menuElem.scroll(0, menuScroll);
		}

		this.lastClicked = option;
		this.doubleClickTimeout = setTimeout(() => {
			this.clearDoubleClickTimeout();
		}, 500);
	}

	/**
	 * Clear the timeout used to detect double clicks.
	 */
	private clearDoubleClickTimeout() {
		if (this.doubleClickTimeout !== null) {
			clearTimeout(this.doubleClickTimeout);
			this.doubleClickTimeout = null;
		}
	}

	/**
	 * Move the focussed option by the specified delta, skipping filtered-out options.
	 * @param delta The number of visible options to move by.
	 */
	private moveFocus(delta: number) {
		if (this.options.length === 0) return;
		let option = this.focussedOption;
		for (let i = 0; i < this.options.length; i++) {
			option = (option + delta + this.options.length) % this.options.length;
			if (this.isOptionVisible(option)) {
				this.setFocussedOption(option, true);
				return;
			}
		}
	}

	/**
	 * Focus the first or last visible option.
	 * @param direction 1 => first option, -1 => last option.
	 */
	private focusEdgeOption(direction: number) {
		const start = direction > 0 ? 0 : this.options.length - 1;
		for (let i = start; i >= 0 && i < this.options.length; i += direction) {
			if (this.isOptionVisible(i)) {
				this.setFocussedOption(i, true);
				return;
			}
		}
	}

	/**
	 * Set the focussed option.
	 * @param option The option to focus, or -1 to clear the focus.
	 * @param scrollIntoView Should the focussed option be scrolled into view.
	 */
	private setFocussedOption(option: number, scrollIntoView: boolean = true) {
		if (this.focussedOption > -1 && this.focussedOption < this.optionsElem.children.length) {
			(<HTMLElement>this.optionsElem.children[this.focussedOption]).classList.remove(CLASS_FOCUSSED);
		}
		this.focussedOption = option;
		if (option > -1 && option < this.optionsElem.children.length) {
			const elem = <HTMLElement>this.optionsElem.children[option];
			elem.classList.add(CLASS_FOCUSSED);
			if (scrollIntoView) elem.scrollIntoView({ block: 'nearest' });
		}
	}

	/**
	 * Is the specified option visible after filtering.
	 * @param option The option to check.
	 * @returns TRUE => The option is visible, FALSE => The option is hidden.
	 */
	private isOptionVisible(option: number) {
		return option > -1 && option < this.optionsElem.children.length &&
			(<HTMLElement>this.optionsElem.children[option]).style.display !== 'none';
	}

	/**
	 * Does a visible option exactly match the specified value.
	 * @param value The value to check.
	 * @returns TRUE => A visible option exactly matches, FALSE => No visible option exactly matches.
	 */
	private hasExactVisibleOption(value: string) {
		const normalizedValue = value.toLowerCase();
		for (let i = 0; i < this.options.length; i++) {
			if (this.isOptionVisible(i) && (this.options[i].name.toLowerCase() === normalizedValue || this.options[i].value.toLowerCase() === normalizedValue)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Update CSS grid rows for grouped dropdown options after filtering.
	 */
	private updateGroupedOptionRows() {
		let branchGroupStartRow = 1, localBranchRow = 0, remoteBranchRow = 0;
		for (let i = 0; i < this.options.length; i++) {
			const elem = <HTMLElement>this.optionsElem.children[i];
			elem.style.gridRow = '';
			if (this.isOptionVisible(i) && this.options[i].group === 'branchMeta') {
				branchGroupStartRow++;
			}
		}
		for (let i = 0; i < this.options.length; i++) {
			if (this.isOptionVisible(i) && this.options[i].group === 'localBranch') {
				(<HTMLElement>this.optionsElem.children[i]).style.gridRow = '' + (branchGroupStartRow + localBranchRow++);
			} else if (this.isOptionVisible(i) && this.options[i].group === 'remoteBranch') {
				(<HTMLElement>this.optionsElem.children[i]).style.gridRow = '' + (branchGroupStartRow + remoteBranchRow++);
			}
		}
	}

	/**
	 * Keep the dropdown menu inside the viewport when opened near the right edge.
	 */
	private positionMenu() {
		this.menuElem.style.left = '0';
		const menuRect = this.menuElem.getBoundingClientRect();
		const overflow = menuRect.right - window.innerWidth + 8;
		if (overflow > 0) {
			this.menuElem.style.left = '-' + Math.ceil(overflow) + 'px';
		}
	}
}
