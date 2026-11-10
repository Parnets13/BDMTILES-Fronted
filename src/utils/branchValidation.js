import { message } from 'antd';
import { ALL_BRANCHES_ID } from '../context/AuthContext.jsx';

/**
 * Validates that a specific branch is selected (not "All Branches").
 * Shows an error message if validation fails.
 * 
 * @param {string|object} activeBranchId - The active branch ID or branch object
 * @param {string} actionName - Optional action name for the error message (default: "save data")
 * @returns {boolean} - Returns true if valid branch selected, false otherwise
 */
export const validateBranchSelected = (activeBranchId, actionName = 'save data') => {
  const branchId = typeof activeBranchId === 'object' 
    ? activeBranchId?._id 
    : activeBranchId;

  if (!branchId || branchId === ALL_BRANCHES_ID) {
    message.error({
      content: 'Please select a specific branch from the header to ' + actionName,
      duration: 4,
    });
    return false;
  }

  return true;
};

/**
 * Validates branch selection and returns a Promise.
 * Useful for async/await flows.
 * 
 * @param {string|object} activeBranchId - The active branch ID or branch object
 * @param {string} actionName - Optional action name for the error message
 * @returns {Promise<boolean>} - Resolves to true if valid, rejects if invalid
 */
export const validateBranchSelectedAsync = (activeBranchId, actionName = 'save data') => {
  return new Promise((resolve, reject) => {
    if (validateBranchSelected(activeBranchId, actionName)) {
      resolve(true);
    } else {
      reject(new Error('No specific branch selected'));
    }
  });
};

/**
 * Checks if "All Branches" is currently selected.
 * 
 * @param {string|object} activeBranchId - The active branch ID or branch object
 * @returns {boolean} - Returns true if "All Branches" is selected
 */
export const isAllBranchesSelected = (activeBranchId) => {
  const branchId = typeof activeBranchId === 'object' 
    ? activeBranchId?._id 
    : activeBranchId;

  return branchId === ALL_BRANCHES_ID;
};
