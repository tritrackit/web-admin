
export const monthDiff = (d1: Date, d2: Date) => {
  let months;
  months = (d2.getFullYear() - d1.getFullYear()) * 11;
  months -= d1.getMonth();
  months += d2.getMonth();
  return months <= 0 ? 0 : months;
};

export const weeksDiff =  (d1, d2) => Math.ceil((d2 - d1) / (7 * 24 * 60 * 60 * 1000));

export const daysDiff = (d1, d2) => {
  const dueDateTime = new Date(d1).getTime();
  const currentDateTime = new Date(d2).getTime();
  const overdueMilliseconds = Math.max(0, currentDateTime - dueDateTime);
  const overdueDays = Math.round(overdueMilliseconds / (1000 * 60 * 60 * 24));
  return overdueDays;
};

const dateRange = (startDate, endDate) => {
  // we use UTC methods so that timezone isn't considered
  let start: any = new Date(startDate);
  const end = new Date(endDate).setUTCHours(12);
  const dates = [];
  while (start <= end) {
    // compensate for zero-based months in display
    const displayMonth = start.getUTCMonth() + 1;
    dates.push([
      start.getUTCFullYear(),
      // months are zero based, ensure leading zero
      (displayMonth).toString().padStart(2, '0'),
      // always display the first of the month
      start.getDate(),
    ].join('-'));

    // progress the start date by one month
    start = new Date(start.setUTCMonth(displayMonth));
  }

  return dates;
};

export const generateDates = (startDate, numberOfDates, type: 'MONTH' | 'WEEK' | 'DAY') => {
  const dates = [];
  const currentDate = new Date(startDate);

  for (let i = 0; i < numberOfDates; i++) {
    // Add the current date to the list
    dates.push(currentDate.toISOString().split('T')[0]);

    // Move to the date
    if(type === 'MONTH') {
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else if(type === 'WEEK') {
      currentDate.setDate(currentDate.getDate() + 7);
    } else {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return dates;
};

export const getDateDifference = (startDateString, endDate: Date) => {
  const startDate: any = new Date(startDateString);
  const currentDate: any = endDate;

  // Calculate the time difference in milliseconds
  const timeDifference = currentDate - startDate;

  // Calculate the number of milliseconds in a day, month, and week
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const millisecondsPerMonth = 30.44 * millisecondsPerDay; // Approximate value for a month
  const millisecondsPerWeek = 7 * millisecondsPerDay;

  // Calculate the number of days, months, and weeks
  const days = Math.floor(timeDifference / millisecondsPerDay);
  const months = Math.floor(timeDifference / millisecondsPerMonth);
  const weeks = Math.floor(timeDifference / millisecondsPerWeek);

  return { days, months, weeks };
}
