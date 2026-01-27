pub fn calculate_elimination_index(
    vrf_result: &[u8; 32],
    player_count: usize,
    round: u8,
) -> Vec<usize> {
    let eliminate_count = player_count / 2;
    let mut eliminated_indices = Vec::with_capacity(eliminate_count);
    
    let base_seed = u64::from_le_bytes(vrf_result[0..8].try_into().unwrap());
    
    for i in 0..eliminate_count {
        let offset_bytes: [u8; 8] = vrf_result[(i * 4) % 24..(i * 4) % 24 + 8]
            .try_into()
            .unwrap_or([0u8; 8]);
        let offset_seed = u64::from_le_bytes(offset_bytes);
        
        let combined_seed = base_seed
            .wrapping_add(offset_seed)
            .wrapping_add(round as u64);
        
        let remaining_players = player_count - i;
        let index = (combined_seed as usize) % remaining_players;
        
        let mut actual_index = index;
        for &prev_idx in &eliminated_indices {
            if actual_index >= prev_idx {
                actual_index += 1;
            }
        }
        
        eliminated_indices.push(actual_index);
        eliminated_indices.sort();
    }
    
    eliminated_indices
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_elimination_calculation() {
        let vrf_result = [1u8; 32];
        let indices = calculate_elimination_index(&vrf_result, 8, 1);
        
        assert_eq!(indices.len(), 4);
        
        for i in 0..indices.len() {
            for j in (i + 1)..indices.len() {
                assert_ne!(indices[i], indices[j]);
            }
        }
        
        for &idx in &indices {
            assert!(idx < 8);
        }
    }

    #[test]
    fn test_deterministic_results() {
        let vrf_result = [42u8; 32];
        
        let indices1 = calculate_elimination_index(&vrf_result, 4, 1);
        let indices2 = calculate_elimination_index(&vrf_result, 4, 1);
        
        assert_eq!(indices1, indices2);
    }
}
