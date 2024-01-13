// Fetch holidays from the API
async function fetchHolidays(prov) {
  const response = await fetch(`https://canada-holidays.ca/api/v1/provinces/${prov}`);
  const data = await response.json();
  return data.province.holidays.map(holiday => new Date(holiday.date));
}

// Check if a date is an off day
function isOffDay(date, offDays) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[date.getDay()];
  //console.log(`Checking if ${date.toISOString().split('T')[0]} (${dayName}) is an off day. Exclude:`, offDays.includes(dayName));
  return offDays.includes(dayName);
}

// Convert string to Date object in local time zone
function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Calculate days function
// Modify calculateDaysFunction to accept individual parameters
function calculateDaysFunction({startDate, endDate, holidays, offDays, ignoreDates}) {
  console.log('calcFunctionCalled', {startDate, endDate, holidays, offDays, ignoreDates})

  let count = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const currentIsoDate = d.toISOString().split('T')[0]; // Extract date part

    const isOffDayResult = isOffDay(d, offDays);
    const isHoliday = holidays.some(holiday => holiday.toISOString().split('T')[0] === currentIsoDate);
    const isIgnoredDate = ignoreDates.includes(currentIsoDate);

    // Log the reason for exclusion or inclusion of the date
    if (isOffDayResult) {
      console.log(`${currentIsoDate} is an off day.`);
    } else if (isHoliday) {
      console.log(`${currentIsoDate} is a holiday.`);
    } else if (isIgnoredDate) {
      console.log(`${currentIsoDate} is an ignored date.`);
    } else {
      console.log(`${currentIsoDate} is counted.`);
      count++;
    }
  }
  console.log('Total count:', count);
  return count;
}


/*
{
	"ID" : "62C5F894-7D1C-9C46-A7A5-899B77E7DDA5",
	"absent" : 
	{
		"12months" : 
		[
			[ "" ]
		],
		"soFar" : 
		[
			[ "" ]
		],
		"thisYear" : 
		[
			[ "" ]
		]
	},
	"offDays" : [ "Saturday", "Sunday" ],
	"path" : "result",
	"prov" : "ON",
	"vacation" : 
	{
		"12months" : 
		[
			[ "2024-01-10", "2024-01-02" ]
		],
		"soFar" : [],
		"upcoming" : 
		[
			[ "2024-02-24", "2024-02-23" ],
			[ "2024-08-10", "2024-07-29" ]
		]
	}
}
*/



window.calculateDays = async function(data) {
  console.log('calcCalled')
  const json = JSON.parse(data)
  console.log('json',json)  

  const offDays = json.offDays || [] // Array of day names
  const ignoreDates = json.ignoreDates || [] // Array of dates in "YYYY-MM-DD" format
  const prov = json.prov || 'ON'
  const path = json.path || 'result'
  const holidays = await fetchHolidays(prov);
  const absent = json.absent;
  const vacation = json.vacation;

  // New object to store results
  let results = {
    absentResults: {},
    vacationResults: {}
  };

  const processKey = async (key, obj, resultObj) => {
    let total = 0; // Initialize a variable to hold the sum of counts
  
    for (const dateRange of obj[key]) {
      // Check if the date range array is empty
      if (dateRange.length === 0) {
        console.log(`No dates for ${key} in one of the date ranges, returning 0 for this range`);
        continue;
      }
  
      // Assuming each date range is an array of date strings
      if (dateRange.length >= 2) {
        let endDate = parseLocalDate(dateRange[0]);
        const startDate = parseLocalDate(dateRange[1]);
  
        // Reduce endDate by one day
        endDate.setDate(endDate.getDate() - 1);
  
        if (startDate > endDate) {
          console.log('startDate is greater than endDate for', dateRange);
          // Decide how you want to handle this error, e.g., skip this range, set total to an error, etc.
        } else {
          const count = await calculateDaysFunction({startDate, endDate, holidays, offDays, ignoreDates});
          console.log(`For ${key}, range ${dateRange}, returning ${count}`);
          total += count; // Add the count to the total
        }
      } else {
        console.log('Not enough dates for', key, 'in one of the date ranges');
        // Decide how you want to handle this error
      }
    }
  
    resultObj[key] = total; // Store the total count for this key
  };
  
  
  

  // Process 'absent' and 'vacation' objects
  for (const key in absent) {
    results.absentResults[key] = [];
    await processKey(key, absent, results.absentResults);
  }

  for (const key in vacation) {
    results.vacationResults[key] = [];
    await processKey(key, vacation, results.vacationResults);
  }

  console.log('Final Results:', results);

  FileMaker.PerformScript('stats * callback', JSON.stringify({results,path}));
  return results;
}


